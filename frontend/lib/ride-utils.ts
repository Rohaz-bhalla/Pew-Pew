// Small helpers shared by the rides, ride detail and console pages.

export interface StopRequest {
  riderClerkId: string;
  riderName?: string;
  place: string;
}

export interface Ride {
  id: number;
  origin: string;
  destination: string;
  vehicleType?: string; // "CAR" | "E_RICKSHAW"
  totalFare?: number; // whole trip, in rupees
  price: number; // per person, in rupees
  totalSeats?: number;
  availableSeats: number;
  bargainEnabled?: boolean; // true when the driver accepts lower offers
  driverName: string;
  driverClerkId?: string;
  departureTime?: string;
  stops?: string[];
  stopRequests?: StopRequest[];
  passengerClerkIds: string[];
  passengerNames?: Record<string, string>; // clerkId -> name
  passengerFares?: Record<string, number>; // clerkId -> price that rider pays
}

// Vehicle options. Add a new one here and in RideController.java.
export const vehicles = {
  CAR: { label: "Pool car", maxSeats: 6 },
  E_RICKSHAW: { label: "E-rickshaw", maxSeats: 4 },
} as const;

export type VehicleType = keyof typeof vehicles;

export function vehicleLabel(type?: string) {
  return type === "E_RICKSHAW" ? vehicles.E_RICKSHAW.label : vehicles.CAR.label;
}

export function rupees(amount: number) {
  return `₹${Math.round(amount)}`;
}

// origin -> stops -> destination
export function routeOf(ride: Ride) {
  return [ride.origin, ...(ride.stops ?? []), ride.destination];
}

/**
 * Does this ride go the way the rider wants?
 *  "exact"            - "from" comes before "to" on the ride's route (stops count)
 *  "same-destination" - heading to the same place, but "from" is not on the route yet
 *                       (the rider can ask the driver to add a stop)
 *  "none"             - not a match
 */
export function routeMatch(
  ride: Ride,
  from: string,
  to: string,
): "exact" | "same-destination" | "none" {
  const f = from.trim().toLowerCase();
  const t = to.trim().toLowerCase();
  if (!f && !t) return "exact";

  const route = routeOf(ride).map((place) => place.toLowerCase());
  const fromIndex = f ? route.findIndex((place) => place.includes(f)) : -1;

  if (!f || fromIndex !== -1) {
    if (!t) return "exact";
    if (route.some((place, i) => i > fromIndex && place.includes(t))) {
      return "exact";
    }
  }

  if (f && t && ride.destination.toLowerCase().includes(t)) {
    return "same-destination";
  }
  return "none";
}
