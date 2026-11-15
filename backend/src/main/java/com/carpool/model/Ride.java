package com.carpool.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

@Entity
@Table(name = "rides")
@Data
public class Ride {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String origin;
    private String destination;

    private String vehicleType;   // "CAR" (pool car) or "E_RICKSHAW"

    // Money is in rupees.
    private Double totalFare;     // what the driver wants for the whole trip, e.g. 4000
    private Double price;         // per person = totalFare / seats (calculated by the server)
    private Integer totalSeats;   // seats when the ride was posted
    private Integer availableSeats;

    // Lowest per-person price the driver would accept when a rider bargains.
    // WRITE_ONLY: the server accepts it but never sends it back, so riders cannot see it.
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private Double minPrice;

    private String driverName;
    private String driverClerkId; // who created the ride (set by the server from the login token)
    private LocalDateTime departureTime;

    // Stops between origin and destination (the driver's own, plus accepted requests)
    @ElementCollection
    private List<String> stops = new ArrayList<>();

    // Stops that riders have asked for and the driver has not answered yet
    @ElementCollection
    private List<StopRequest> stopRequests = new ArrayList<>();

    @ElementCollection
    private List<String> passengerClerkIds = new ArrayList<>();

    // clerkUserId -> passenger name
    @ElementCollection
    private Map<String, String> passengerNames = new HashMap<>();

    // clerkUserId -> the price that rider agreed to pay (listed price or a bargained one)
    @ElementCollection
    private Map<String, Double> passengerFares = new HashMap<>();
    
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String driverPhone;
    
    @JsonIgnore
    @ElementCollection
    private Map<String, String> passengerPhones = new HashMap<>();
    // Tells the frontend whether to show the "Make an offer" box
    @JsonProperty("bargainEnabled")
    public boolean isBargainEnabled() {
        return minPrice != null && price != null && minPrice < price;
    }
}