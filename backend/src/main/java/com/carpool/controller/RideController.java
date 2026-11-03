package com.carpool.controller;

import com.carpool.model.Ride;
import com.carpool.model.StopRequest;
import com.carpool.repository.RideRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/rides")
public class RideController {

    private static final int MAX_STOPS = 5;

    private final RideRepository rideRepository;

    @Autowired
    public RideController(RideRepository rideRepository) {
        this.rideRepository = rideRepository;
    }

    // ---------- Anyone can look ----------

    @GetMapping
    public List<Ride> getAllRides(@RequestParam(required = false) String city) {
        if (city != null && !city.trim().isEmpty()) {
            return rideRepository.findByOriginContainingIgnoreCaseOrDestinationContainingIgnoreCase(city, city);
        }
        return rideRepository.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Ride> getRideById(@PathVariable Long id) {
        Optional<Ride> ride = rideRepository.findById(id);
        return ride.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // ---------- Logged-in users only ----------
    // jwt.getSubject() is the user's Clerk id. It comes from the verified token,
    // so nobody can pretend to be someone else.

    @PostMapping
    public ResponseEntity<?> createRide(@RequestBody Ride ride, @AuthenticationPrincipal Jwt jwt) {
        // Vehicle: pool car (up to 6 riders) or e-rickshaw (up to 4 riders)
        String vehicle = ride.getVehicleType() == null ? "CAR" : ride.getVehicleType();
        if (!vehicle.equals("CAR") && !vehicle.equals("E_RICKSHAW")) {
            return ResponseEntity.badRequest().body("Choose a pool car or an e-rickshaw");
        }
        int maxSeats = vehicle.equals("CAR") ? 6 : 4;

        Integer seats = ride.getAvailableSeats();
        if (seats == null || seats < 1) {
            return ResponseEntity.badRequest().body("Offer at least 1 seat");
        }
        if (seats > maxSeats) {
            return ResponseEntity.badRequest().body("This vehicle fits up to " + maxSeats + " riders");
        }

        // The driver enters the TOTAL fare in rupees; we split it between the riders.
        // Example: 4000 for 4 riders = 1000 each. (Rounded up so the driver is not short.)
        if (ride.getTotalFare() == null || ride.getTotalFare() <= 0) {
            return ResponseEntity.badRequest().body("Enter the total fare in rupees");
        }
        double perPerson = Math.ceil(ride.getTotalFare() / seats);

        // Lowest price the driver will accept when someone bargains (optional)
        Double minPrice = ride.getMinPrice();
        if (minPrice != null && (minPrice <= 0 || minPrice >= perPerson)) {
            return ResponseEntity.badRequest()
                    .body("The lowest price must be more than 0 and less than " + (long) perPerson);
        }

        ride.setId(null);                              // always a new ride
        ride.setVehicleType(vehicle);
        ride.setTotalSeats(seats);
        ride.setPrice(perPerson);
        ride.setDriverClerkId(jwt.getSubject());       // owner = the logged-in user
        ride.setStops(cleanStops(ride.getStops()));
        ride.setStopRequests(new ArrayList<>());
        ride.setPassengerClerkIds(new ArrayList<>());  // nobody has booked yet
        ride.setPassengerNames(new HashMap<>());
        ride.setPassengerFares(new HashMap<>());
        return ResponseEntity.ok(rideRepository.save(ride));
    }

    // Book a seat. If "offer" is given, the rider is bargaining.
    @PutMapping("/{id}/book")
    public ResponseEntity<?> bookSeat(@PathVariable Long id,
                                      @RequestParam(required = false) String passengerName,
                                      @RequestParam(required = false) Double offer,
                                      @AuthenticationPrincipal Jwt jwt) {
        Optional<Ride> optionalRide = rideRepository.findById(id);
        if (!optionalRide.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        Ride ride = optionalRide.get();
        String userId = jwt.getSubject();

        if (userId.equals(ride.getDriverClerkId())) {
            return ResponseEntity.badRequest().body("You cannot book your own ride");
        }
        if (ride.getAvailableSeats() <= 0) {
            return ResponseEntity.badRequest().body("No seats left");
        }
        if (ride.getPassengerClerkIds().contains(userId)) {
            return ResponseEntity.badRequest().body("You have already booked a seat on this ride");
        }

        // Work out the price this rider pays
        double fare = ride.getPrice();
        if (offer != null && offer < ride.getPrice()) {
            if (offer <= 0) {
                return ResponseEntity.badRequest().body("Enter a valid offer");
            }
            if (!ride.isBargainEnabled()) {
                return ResponseEntity.badRequest().body("This driver is not taking lower offers");
            }
            if (offer < ride.getMinPrice()) {
                return ResponseEntity.badRequest().body("Offer too low, please add more");
            }
            fare = offer; // the driver's lowest price is met, so the offer is accepted
        }

        ride.setAvailableSeats(ride.getAvailableSeats() - 1);
        ride.getPassengerClerkIds().add(userId);
        ride.getPassengerFares().put(userId, fare);
        if (passengerName != null && !passengerName.isBlank()) {
            ride.getPassengerNames().put(userId, passengerName);
        }
        rideRepository.save(ride);

        return ResponseEntity.ok(ride);
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<?> cancelBooking(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        Optional<Ride> optionalRide = rideRepository.findById(id);
        if (!optionalRide.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        Ride ride = optionalRide.get();
        String userId = jwt.getSubject();

        // You can only cancel your own booking
        if (!ride.getPassengerClerkIds().contains(userId)) {
            return ResponseEntity.badRequest().body("You do not have a booking for this ride");
        }

        ride.getPassengerClerkIds().remove(userId);
        ride.getPassengerNames().remove(userId);
        ride.getPassengerFares().remove(userId);
        ride.setAvailableSeats(ride.getAvailableSeats() + 1);
        rideRepository.save(ride);

        return ResponseEntity.ok(ride);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteRide(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        Optional<Ride> optionalRide = rideRepository.findById(id);
        if (!optionalRide.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        // Only the person who created the ride can delete it
        if (!jwt.getSubject().equals(optionalRide.get().getDriverClerkId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("You can only delete your own rides");
        }

        rideRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ---------- Stop requests ----------
    // A rider going the same way asks for a stop; the driver accepts or declines.

    @PostMapping("/{id}/stop-requests")
    public ResponseEntity<?> requestStop(@PathVariable Long id,
                                         @RequestParam String place,
                                         @RequestParam(required = false) String riderName,
                                         @AuthenticationPrincipal Jwt jwt) {
        Optional<Ride> optionalRide = rideRepository.findById(id);
        if (!optionalRide.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        Ride ride = optionalRide.get();
        String userId = jwt.getSubject();
        String cleanPlace = place.trim();

        if (userId.equals(ride.getDriverClerkId())) {
            return ResponseEntity.badRequest().body("This is your ride. Add stops when you post it");
        }
        if (cleanPlace.isEmpty() || cleanPlace.length() > 60) {
            return ResponseEntity.badRequest().body("Enter a place name (up to 60 characters)");
        }
        if (ride.getStops().size() >= MAX_STOPS) {
            return ResponseEntity.badRequest().body("This ride already has " + MAX_STOPS + " stops");
        }
        boolean alreadyOnRoute = ride.getOrigin().equalsIgnoreCase(cleanPlace)
                || ride.getDestination().equalsIgnoreCase(cleanPlace)
                || ride.getStops().stream().anyMatch(s -> s.equalsIgnoreCase(cleanPlace));
        if (alreadyOnRoute) {
            return ResponseEntity.badRequest().body("That place is already on this ride");
        }
        boolean alreadyAsked = ride.getStopRequests().stream()
                .anyMatch(r -> userId.equals(r.getRiderClerkId()));
        if (alreadyAsked) {
            return ResponseEntity.badRequest().body("You already asked for a stop. Withdraw it first to change it");
        }

        StopRequest request = new StopRequest();
        request.setRiderClerkId(userId);
        request.setRiderName(riderName == null || riderName.isBlank() ? "A rider" : riderName);
        request.setPlace(cleanPlace);
        ride.getStopRequests().add(request);
        rideRepository.save(ride);

        return ResponseEntity.ok(ride);
    }

    // Driver says yes: the place becomes a stop on the ride
    @PutMapping("/{id}/stop-requests/{riderId}/accept")
    public ResponseEntity<?> acceptStop(@PathVariable Long id,
                                        @PathVariable String riderId,
                                        @AuthenticationPrincipal Jwt jwt) {
        Optional<Ride> optionalRide = rideRepository.findById(id);
        if (!optionalRide.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        Ride ride = optionalRide.get();
        if (!jwt.getSubject().equals(ride.getDriverClerkId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("Only the ride creator can accept stops");
        }

        Optional<StopRequest> request = ride.getStopRequests().stream()
                .filter(r -> riderId.equals(r.getRiderClerkId()))
                .findFirst();
        if (!request.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        if (ride.getStops().size() >= MAX_STOPS) {
            return ResponseEntity.badRequest().body("This ride already has " + MAX_STOPS + " stops");
        }

        ride.getStops().add(request.get().getPlace());
        ride.getStopRequests().remove(request.get());
        rideRepository.save(ride);

        return ResponseEntity.ok(ride);
    }

    // Driver says no, or the rider withdraws their own request
    @DeleteMapping("/{id}/stop-requests/{riderId}")
    public ResponseEntity<?> removeStopRequest(@PathVariable Long id,
                                               @PathVariable String riderId,
                                               @AuthenticationPrincipal Jwt jwt) {
        Optional<Ride> optionalRide = rideRepository.findById(id);
        if (!optionalRide.isPresent()) {
            return ResponseEntity.notFound().build();
        }

        Ride ride = optionalRide.get();
        String userId = jwt.getSubject();
        boolean isDriver = userId.equals(ride.getDriverClerkId());
        boolean isTheRider = userId.equals(riderId);
        if (!isDriver && !isTheRider) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body("You cannot change someone else's request");
        }

        ride.getStopRequests().removeIf(r -> riderId.equals(r.getRiderClerkId()));
        rideRepository.save(ride);

        return ResponseEntity.ok(ride);
    }

    // Trim names, drop blanks, keep at most MAX_STOPS
    private List<String> cleanStops(List<String> stops) {
        List<String> cleaned = new ArrayList<>();
        if (stops != null) {
            for (String stop : stops) {
                if (stop != null && !stop.trim().isEmpty() && cleaned.size() < MAX_STOPS) {
                    cleaned.add(stop.trim());
                }
            }
        }
        return cleaned;
    }
}