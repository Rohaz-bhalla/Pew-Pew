"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { format } from "date-fns";
import { Car, Plus, Ticket, Trash2 } from "lucide-react";

import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useAuthFetch, failMessage } from "@/lib/use-auth-fetch";
import { useRole, type Role } from "@/lib/use-role";
import { VehicleChip } from "@/components/ride-cards";
import { rupees, type Ride } from "@/lib/ride-utils";
import { RideContacts } from "@/components/ride-contacts";

// Colors, radii and font come from the theme tokens in globals.css.

const btnBase =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary";
const btnFilled = `${btnBase} bg-m-primary text-m-on-primary hover:bg-m-primary-hover`;
const btnOutlined = `${btnBase} border border-m-outline text-m-primary hover:bg-m-surface-container`;
const btnOutlinedError = `${btnBase} border border-m-error text-m-error hover:bg-m-error-container`;
const btnTextError = `${btnBase} px-3 text-m-error hover:bg-m-error-container`;
const pageClass =
  "font-m min-h-[calc(100svh-4rem)] bg-m-surface text-m-on-surface";

function when(ride: Ride) {
  return ride.departureTime
    ? format(new Date(ride.departureTime), "PPP, p")
    : "Not scheduled";
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-m-card bg-m-surface-low p-4">
      <p className="text-xs text-m-on-surface-variant">{label}</p>
      <p className="text-3xl font-semibold text-m-primary">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-m-card border border-dashed border-m-outline-variant px-6 py-10 text-center text-m-on-surface-variant">
      {text}
    </div>
  );
}

/* ------------------------------ Rider ------------------------------ */

function RiderView({
  rides,
  userId,
  onCancel,
}: {
  rides: Ride[];
  userId: string;
  onCancel: (rideId: number) => void;
}) {
  const router = useRouter();
  const bookings = rides.filter((r) => r.passengerClerkIds?.includes(userId));
  const totalFare = bookings.reduce(
    (sum, r) => sum + (r.passengerFares?.[userId] ?? r.price),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Active bookings" value={bookings.length} />
        <Stat label="Total fare" value={rupees(totalFare)} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My bookings</h2>
        <Link href="/rides" className={btnFilled}>
          Find a ride
        </Link>
      </div>

      {bookings.length === 0 ? (
        <Empty text="You haven't booked any seats yet." />
      ) : (
        <div className="grid gap-4">
          {bookings.map((ride) => (
            <article
              key={ride.id}
              className="flex flex-col gap-4 rounded-m-card border border-m-outline-variant bg-m-surface-low p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="flex items-center gap-2 text-lg font-semibold">
                  <Ticket className="h-5 w-5 shrink-0 text-m-primary" />
                  <span className="truncate">
                    {ride.origin} to {ride.destination}
                  </span>
                </p>
                <p className="text-sm text-m-on-surface-variant">
                  {when(ride)}
                </p>
                <p className="text-sm text-m-on-surface-variant">
                  Created by {ride.driverName}, you pay{" "}
                  {rupees(ride.passengerFares?.[userId] ?? ride.price)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={btnFilled}
                  onClick={() => router.push(`/rides/${ride.id}`)}
                >
                  View ticket
                </button>
                <button
                  type="button"
                  className={btnOutlinedError}
                  onClick={() => onCancel(ride.id)}
                >
                  Cancel
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Driver ------------------------------ */

function DriverView({
  rides,
  userId,
  onDelete,
  onAcceptStop,
  onDeclineStop,
}: {
  rides: Ride[];
  userId: string;
  onDelete: (rideId: number) => void;
  onAcceptStop: (rideId: number, riderId: string) => void;
  onDeclineStop: (rideId: number, riderId: string) => void;
}) {
  const router = useRouter();
  const myRides = rides.filter((r) => r.driverClerkId === userId);
  const passengers = myRides.reduce(
    (sum, r) => sum + (r.passengerClerkIds?.length ?? 0),
    0,
  );
  const openSeats = myRides.reduce((sum, r) => sum + r.availableSeats, 0);
  // What riders have agreed to pay so far (listed or bargained prices)
  const earnings = myRides.reduce(
    (sum, r) =>
      sum + Object.values(r.passengerFares ?? {}).reduce((a, b) => a + b, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rides posted" value={myRides.length} />
        <Stat label="Passengers" value={passengers} />
        <Stat label="Open seats" value={openSeats} />
        <Stat label="Booked fares" value={rupees(earnings)} />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">My rides</h2>
        <Link href="/rides#post-ride" className={btnFilled}>
          <Plus className="h-4 w-4" />
          Post a ride
        </Link>
      </div>

      {myRides.length === 0 ? (
        <Empty text="You haven't posted any rides yet." />
      ) : (
        <div className="grid gap-4">
          {myRides.map((ride) => {
            const booked = ride.passengerClerkIds?.length ?? 0;
            return (
              <article
                key={ride.id}
                className="space-y-4 rounded-m-card border border-m-outline-variant bg-m-surface-low p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-2 text-lg font-semibold">
                      <Car className="h-5 w-5 shrink-0 text-m-primary" />
                      <span className="truncate">
                        {ride.origin} to {ride.destination}
                      </span>
                    </p>
                    {ride.stops && ride.stops.length > 0 && (
                      <p className="text-sm text-m-on-surface-variant">
                        via {ride.stops.join(", ")}
                      </p>
                    )}
                    <p className="text-sm text-m-on-surface-variant">
                      {when(ride)}
                    </p>
                    <VehicleChip type={ride.vehicleType} />
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-2xl font-semibold text-m-primary">
                      {rupees(ride.price)}
                    </p>
                    <p className="text-sm text-m-on-surface-variant">
                      per person, {booked} booked, {ride.availableSeats} left
                    </p>
                  </div>
                </div>

                {/* Who booked */}
                <div>
                  <p className="mb-2 text-xs text-m-on-surface-variant">
                    Passengers
                  </p>
                  {booked === 0 ? (
                    <p className="text-sm text-m-on-surface-variant">
                      No bookings yet.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ride.passengerClerkIds.map((cid, i) => (
                        <span
                          key={cid}
                          className="rounded-full bg-m-primary-container px-3 py-1 text-sm font-medium text-m-on-primary-container"
                        >
                          {ride.passengerNames?.[cid] || `Passenger ${i + 1}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  ...existing block...
                </div>

                {booked > 0 && <RideContacts rideId={ride.id} />}

                {/* Stop requests from riders going the same way */}
                {ride.stopRequests && ride.stopRequests.length > 0 && (
                  <div className="space-y-2 rounded-lg bg-m-surface-container p-3">
                    <p className="text-xs font-medium text-m-on-surface-variant">
                      Stop requests
                    </p>
                    {ride.stopRequests.map((req) => (
                      <div
                        key={req.riderClerkId}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <p className="text-sm">
                          <strong>{req.riderName || "A rider"}</strong> wants a
                          stop at <strong>{req.place}</strong>
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className={btnFilled}
                            onClick={() =>
                              onAcceptStop(ride.id, req.riderClerkId)
                            }
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className={btnOutlined}
                            onClick={() =>
                              onDeclineStop(ride.id, req.riderClerkId)
                            }
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2 border-t border-m-outline-variant pt-4">
                  <button
                    type="button"
                    className={btnTextError}
                    onClick={() => onDelete(ride.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete ride
                  </button>
                  <button
                    type="button"
                    className={btnOutlined}
                    onClick={() => router.push(`/rides/${ride.id}`)}
                  >
                    View ride
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function ConsolePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { role, setRole } = useRole();
  const authFetch = useAuthFetch();

  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  const userId = user?.id || "";

  const fetchRides = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rides`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      setRides(await res.json());
    } catch (err) {
      console.error("Failed to fetch rides:", err);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRides();
  }, [fetchRides]);

  const chooseRole = async (newRole: Role) => {
    try {
      await setRole(newRole);
    } catch (err) {
      console.error("Failed to save role:", err);
      toast.add({ type: "error", description: "Could not save your choice." });
    }
  };

  const handleCancelBooking = async (rideId: number) => {
    try {
      const res = await authFetch(`${API_URL}/api/rides/${rideId}/cancel`, {
        method: "PUT",
      });
      if (res.ok) {
        fetchRides();
        toast.add({ type: "info", description: "Booking cancelled." });
      } else {
        toast.add({
          type: "error",
          description: failMessage(
            res.status,
            await res.text(),
            "Failed to cancel booking",
          ),
        });
      }
    } catch (err) {
      console.error("Failed to cancel booking:", err);
      toast.add({
        type: "error",
        description:
          "Could not reach the backend (is it running? or blocked by CORS).",
      });
    }
  };

  const handleDeleteRide = async (rideId: number) => {
    if (
      !window.confirm("Delete this ride? Passengers will lose their booking.")
    ) {
      return;
    }
    try {
      const res = await authFetch(`${API_URL}/api/rides/${rideId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchRides();
        toast.add({ type: "info", description: "Your ride has been removed." });
      } else {
        toast.add({
          type: "error",
          description: failMessage(
            res.status,
            await res.text(),
            "Failed to delete ride",
          ),
        });
      }
    } catch (err) {
      console.error("Failed to delete ride:", err);
      toast.add({
        type: "error",
        description:
          "Could not reach the backend (is it running? or blocked by CORS).",
      });
    }
  };

  const handleAcceptStop = async (rideId: number, riderId: string) => {
    try {
      const res = await authFetch(
        `${API_URL}/api/rides/${rideId}/stop-requests/${riderId}/accept`,
        { method: "PUT" },
      );
      if (res.ok) {
        fetchRides();
        toast.add({ type: "success", description: "Stop added to your ride." });
      } else {
        toast.add({
          type: "error",
          description: (await res.text()) || "Could not add the stop.",
        });
      }
    } catch (err) {
      console.error("Failed to accept stop:", err);
      toast.add({
        type: "error",
        description:
          "Could not reach the backend (is it running? or blocked by CORS).",
      });
    }
  };

  const handleDeclineStop = async (rideId: number, riderId: string) => {
    try {
      const res = await authFetch(
        `${API_URL}/api/rides/${rideId}/stop-requests/${riderId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        fetchRides();
        toast.add({ type: "info", description: "Stop request declined." });
      }
    } catch (err) {
      console.error("Failed to decline stop:", err);
    }
  };

  // 1. Still loading Clerk
  if (!isLoaded || loading) {
    return (
      <div className={pageClass}>
        <div className="mx-auto max-w-4xl space-y-4 px-4 pt-8">
          <div className="h-10 w-48 animate-pulse rounded-full bg-m-surface-container" />
          <div className="h-32 animate-pulse rounded-m-card bg-m-surface-container" />
          <div className="h-48 animate-pulse rounded-m-card bg-m-surface-container" />
        </div>
      </div>
    );
  }

  // 2. Not signed in
  if (!isSignedIn) {
    return (
      <div className={pageClass}>
        <div className="mx-auto mt-10 max-w-md space-y-2 rounded-m-sheet border border-m-outline-variant bg-m-surface-low p-8 text-center">
          <h1 className="text-2xl font-semibold">Console</h1>
          <p className="text-m-on-surface-variant">
            Sign in (top right) to see your bookings and rides.
          </p>
        </div>
      </div>
    );
  }

  // 3. Signed in but has not picked rider / driver yet
  if (!role) {
    return (
      <div className={pageClass}>
        <div className="mx-auto max-w-2xl space-y-6 px-4 pt-10">
          <div>
            <h1 className="text-3xl font-semibold">
              How will you use Pew Pew?
            </h1>
            <p className="text-m-on-surface-variant">
              You can switch any time from the console.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseRole("rider")}
              className="cursor-pointer space-y-2 rounded-m-sheet border border-m-outline-variant bg-m-surface-low p-6 text-left transition-colors hover:bg-m-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary"
            >
              <Ticket className="h-7 w-7 text-m-primary" />
              <p className="text-xl font-semibold">Rider</p>
              <p className="text-m-on-surface-variant">
                Find a ride and book a seat.
              </p>
            </button>
            <button
              type="button"
              onClick={() => chooseRole("driver")}
              className="cursor-pointer space-y-2 rounded-m-sheet border border-m-outline-variant bg-m-surface-low p-6 text-left transition-colors hover:bg-m-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary"
            >
              <Car className="h-7 w-7 text-m-primary" />
              <p className="text-xl font-semibold">Driver</p>
              <p className="text-m-on-surface-variant">
                Post rides and manage your passengers.
              </p>
            </button>
          </div>
        </div>
      </div>

    );
  }

  // 4. The console
  return (
    <div className={`${pageClass} pb-16`}>
      <main className="mx-auto max-w-4xl space-y-6 px-4 pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Console</h1>
            <p className="text-m-on-surface-variant">
              {user?.fullName || user?.username || "Welcome"}
            </p>
          </div>

          {/* Rider / Driver switch */}
          <div
            role="tablist"
            className="inline-flex self-start overflow-hidden rounded-full border border-m-outline"
          >
            {(["rider", "driver"] as const).map((r, i) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={role === r}
                onClick={() => chooseRole(r)}
                className={cn(
                  "h-10 cursor-pointer px-6 text-sm font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-m-primary",
                  i > 0 && "border-l border-m-outline",
                  role === r
                    ? "bg-m-primary-container text-m-on-primary-container"
                    : "hover:bg-m-surface-container",
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {role === "driver" ? (
          <DriverView
            rides={rides}
            userId={userId}
            onDelete={handleDeleteRide}
            onAcceptStop={handleAcceptStop}
            onDeclineStop={handleDeclineStop}
          />
        ) : (
          <RiderView
            rides={rides}
            userId={userId}
            onCancel={handleCancelBooking}
          />
        )}
      </main>
    </div>

  );
}
