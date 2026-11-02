package com.carpool.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "rides")
@Data
public class Ride {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String origin;
    private String destination;
    private Double price;
    private Integer availableSeats;
    private String driverName;
    private LocalDateTime departureTime; // Departure date and time

    // Extra stops between origin and destination
    @ElementCollection
    private List<String> stops = new ArrayList<>();

    @ElementCollection
    private List<String> passengerClerkIds = new ArrayList<>();

    // clerkUserId -> passenger name (so the ride page can show who booked)
    @ElementCollection
    private Map<String, String> passengerNames = new HashMap<>();
}