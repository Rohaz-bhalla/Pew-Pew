// ParticipantLocation.java: one person on the map
package com.carpool.dto;

public record ParticipantLocation(
        String userId,
        String name,
        String role, // "DRIVER" or "PASSENGER"
        double latitude,
        double longitude,
        long updatedAt, // epoch millis of the last GPS update
        Double distanceKm, // passengers only: distance to the driver (else null)
        Integer etaMinutes // passengers only: rough minutes to reach the driver
) {
}