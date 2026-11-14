// LocationUpdate.java: what a phone sends. Only coordinates. Identity comes from the token.
package com.carpool.dto;

public record LocationUpdate(double latitude, double longitude) {
}