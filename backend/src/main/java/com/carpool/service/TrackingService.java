package com.carpool.service;

import com.carpool.dto.ParticipantLocation;
import com.carpool.dto.TrackingSnapshot;
import com.carpool.model.Ride;
import com.carpool.repository.RideRepository;
import com.carpool.util.GeoUtils;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class TrackingService {

    private static final long STALE_AFTER_MS = 5 * 60 * 1000L; // hide positions older than 5 min
    private static final double AVG_SPEED_KMH = 25.0; // rough speed for the ETA

    private record Position(double lat, double lng, long updatedAt) {
    }

    // rideId -> (clerkUserId -> latest position). Lives in memory only.
    private final Map<Long, Map<String, Position>> positions = new ConcurrentHashMap<>();

    private final RideRepository rideRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public TrackingService(RideRepository rideRepository, SimpMessagingTemplate messagingTemplate) {
        this.rideRepository = rideRepository;
        this.messagingTemplate = messagingTemplate;
    }

    // @Transactional is REQUIRED here: WebSocket threads have no open DB session,
    // and Ride's lists (passengerClerkIds, ...) are lazy. Without it you get
    // LazyInitializationException.
    @Transactional(readOnly = true)
    public void updateLocation(Long rideId, String userId, double lat, double lng) {
        if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) {
            throw new IllegalArgumentException("Invalid coordinates");
        }
        Ride ride = loadRideForParticipant(rideId, userId);
        positions.computeIfAbsent(rideId, id -> new ConcurrentHashMap<>())
                .put(userId, new Position(lat, lng, System.currentTimeMillis()));
        broadcast(ride);
    }

    @Transactional(readOnly = true)
    public void stopSharing(Long rideId, String userId) {
        Ride ride = loadRideForParticipant(rideId, userId);
        Map<String, Position> live = positions.get(rideId);
        if (live != null)
            live.remove(userId);
        broadcast(ride);
    }

    /** Used by the REST endpoint so the page has data the moment it opens. */
    @Transactional(readOnly = true)
    public TrackingSnapshot snapshotFor(Long rideId, String userId) {
        return buildSnapshot(loadRideForParticipant(rideId, userId), userId);
    }

    // ---------- helpers ----------

    // Only the driver and booked passengers may take part.
    private Ride loadRideForParticipant(Long rideId, String userId) {
        Ride ride = rideRepository.findById(rideId)
                .orElseThrow(() -> new NoSuchElementException("Ride not found"));
        boolean isDriver = userId.equals(ride.getDriverClerkId());
        boolean isPassenger = ride.getPassengerClerkIds().contains(userId);
        if (!isDriver && !isPassenger) {
            throw new AccessDeniedException("You are not part of this ride");
        }
        return ride;
    }

    // Send each participant THEIR OWN view of the ride.
    private void broadcast(Ride ride) {
        Set<String> everyone = new LinkedHashSet<>(ride.getPassengerClerkIds());
        if (ride.getDriverClerkId() != null)
            everyone.add(ride.getDriverClerkId());

        for (String recipient : everyone) {
            messagingTemplate.convertAndSendToUser(
                    recipient,
                    "/queue/rides/" + ride.getId() + "/tracking",
                    buildSnapshot(ride, recipient));
        }
    }

    private TrackingSnapshot buildSnapshot(Ride ride, String viewerId) {
        long now = System.currentTimeMillis();
        String driverId = ride.getDriverClerkId();
        boolean viewerIsDriver = viewerId.equals(driverId);
        Map<String, Position> live = positions.getOrDefault(ride.getId(), Collections.emptyMap());

        Position driverPos = driverId == null ? null : fresh(live.get(driverId), now);

        List<ParticipantLocation> result = new ArrayList<>();
        if (driverPos != null) {
            result.add(toLocation(driverId, ride.getDriverName(), "DRIVER", driverPos, null));
        }

        // The driver sees every passenger; a passenger sees only themselves.
        Collection<String> passengerIds = viewerIsDriver ? ride.getPassengerClerkIds() : List.of(viewerId);

        for (String pid : passengerIds) {
            Position p = fresh(live.get(pid), now);
            if (p == null)
                continue;
            Double km = driverPos == null ? null
                    : GeoUtils.distanceKm(driverPos.lat(), driverPos.lng(), p.lat(), p.lng());
            String name = ride.getPassengerNames().getOrDefault(pid, "Passenger");
            result.add(toLocation(pid, name, "PASSENGER", p, km));
        }
        return new TrackingSnapshot(ride.getId(), viewerIsDriver ? "DRIVER" : "PASSENGER", result, now);
    }

    private Position fresh(Position p, long now) {
        return (p != null && now - p.updatedAt() <= STALE_AFTER_MS) ? p : null;
    }

    private ParticipantLocation toLocation(String userId, String name, String role, Position p, Double km) {
        Double rounded = km == null ? null : Math.round(km * 100) / 100.0;
        Integer eta = km == null ? null : (int) Math.max(1, Math.ceil(km / AVG_SPEED_KMH * 60));
        return new ParticipantLocation(userId, name, role, p.lat(), p.lng(), p.updatedAt(), rounded, eta);
    }
}