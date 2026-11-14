// TrackingSnapshot.java: what one specific viewer receives
package com.carpool.dto;

import java.util.List;

public record TrackingSnapshot(
        Long rideId,
        String viewerRole, // "DRIVER" or "PASSENGER" (the person receiving this)
        List<ParticipantLocation> participants,
        long serverTime) {
}