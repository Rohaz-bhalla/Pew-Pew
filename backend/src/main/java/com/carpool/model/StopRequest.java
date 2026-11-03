package com.carpool.model;

import jakarta.persistence.Embeddable;
import lombok.Data;

// A rider asking the driver to add a stop (e.g. "Ludhiana") to a ride.
@Embeddable
@Data
public class StopRequest {
    private String riderClerkId;
    private String riderName;
    private String place;
}