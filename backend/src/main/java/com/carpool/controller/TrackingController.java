package com.carpool.controller;

import com.carpool.dto.LocationUpdate;
import com.carpool.service.TrackingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.NoSuchElementException;

@RestController
public class TrackingController {

    private static final Logger log = LoggerFactory.getLogger(TrackingController.class);

    private final TrackingService trackingService;

    public TrackingController(TrackingService trackingService) {
        this.trackingService = trackingService;
    }

    // ---- WebSocket: the client SENDS to /app/rides/{id}/location ----
    // principal.getName() = Clerk user id from the verified token (set in
    // StompAuthInterceptor)
    @MessageMapping("/rides/{rideId}/location")
    public void receiveLocation(@DestinationVariable Long rideId,
            LocationUpdate update,
            Principal principal) {
        trackingService.updateLocation(rideId, principal.getName(), update.latitude(), update.longitude());
    }

    @MessageMapping("/rides/{rideId}/location/stop")
    public void stopSharing(@DestinationVariable Long rideId, Principal principal) {
        trackingService.stopSharing(rideId, principal.getName());
    }

    // A bad message is logged and ignored; it must never crash the connection.
    @MessageExceptionHandler
    public void onError(Exception e) {
        log.warn("Tracking message rejected: {}", e.getMessage());
    }

    // ---- REST: initial state when the page opens ----
    @GetMapping("/api/rides/{rideId}/tracking")
    public ResponseEntity<?> getTracking(@PathVariable Long rideId, @AuthenticationPrincipal Jwt jwt) {
        try {
            return ResponseEntity.ok(trackingService.snapshotFor(rideId, jwt.getSubject()));
        } catch (NoSuchElementException e) {
            return ResponseEntity.notFound().build();
        } catch (AccessDeniedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only the driver and booked riders can see live location");
        }
    }
}