"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Car, Check } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useAuthFetch, failMessage } from "@/lib/use-auth-fetch";
import { Barcode } from "@/components/ride-cards";
import { RideContacts } from "@/components/ride-contacts";
import { routeOf, rupees, vehicleLabel, type Ride } from "@/lib/ride-utils";
import { usePhone } from "@/lib/use-phone";
import { LiveTrackingCard } from "@/components/live-tracking-card";

// Colors, radii and font come from the theme tokens in globals.css.

const btnBase =
  "inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary disabled:cursor-not-allowed disabled:border-transparent disabled:bg-m-disabled disabled:text-m-on-disabled";
const btnFilled = `${btnBase} bg-m-primary text-m-on-primary hover:bg-m-primary-hover`;
const btnOutlinedError = `${btnBase} border border-m-error bg-transparent text-m-error hover:bg-m-error-container`;
const smallInput =
  "h-10 w-full rounded-lg bg-m-surface-low px-3 text-sm text-m-on-surface outline-none placeholder:text-m-on-surface-variant focus:ring-2 focus:ring-m-primary";
const smallButton =
  "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-m-primary px-4 text-sm font-medium text-m-on-primary transition-colors hover:bg-m-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary disabled:cursor-not-allowed disabled:bg-m-disabled disabled:text-m-on-disabled";
const pageClass =
  "font-m min-h-[calc(100svh-4rem)] bg-m-surface text-m-on-surface";

function RideDetailsContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  const clerkUserId = user?.id || "";
  const myName = user?.fullName || user?.username || "";
  const authFetch = useAuthFetch(); // fetch + login token
const { ensurePhone } = usePhone();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  // Bargaining
  const [offer, setOffer] = useState("");
  const [offerError, setOfferError] = useState("");

  // Asking for a stop
  const [stopPlace, setStopPlace] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

  useEffect(() => {
    fetch(`${API_URL}/api/rides/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Ride not found");
        return res.json();
      })
      .then((data) => setRide(data))
      .catch((err) => {
        console.error("Failed to fetch ride details:", err);
        toast.add({
          type: "error",
          description: "Could not load ride details.",
        });
      })
      .finally(() => setLoading(false));
  }, [id, API_URL]);

  // Reload this ride after something changed
  const refreshRide = async () => {
    const res = await fetch(`${API_URL}/api/rides/${id}`);
    if (res.ok) setRide(await res.json());
  };

  // Book a seat. Pass an amount to bargain, or nothing to pay the listed price.
  const handleBookSeat = async (offerAmount?: number) => {
    if (!isSignedIn) {
      toast.add({
        type: "error",
        description: "Please sign in to book a seat!",
      });
      return;
    }

    // NEW: ask for (or reuse the saved) phone number
    const phone = await ensurePhone();
    if (!phone) {
      toast.add({
        type: "error",
        description: "A valid phone number is needed to book a seat.",
      });
      return;
    }

    try {
      const offerPart = offerAmount ? `&offer=${offerAmount}` : "";
      const res = await authFetch(
        `${API_URL}/api/rides/${id}/book?passengerName=${encodeURIComponent(myName)}&passengerPhone=${encodeURIComponent(phone)}${offerPart}`,
        { method: "PUT" },
      );

      if (res.ok) {
        await refreshRide();
        setOffer("");
        setOfferError("");
        toast.add({
          type: "success",
          description: offerAmount
            ? `Offer accepted! Booked at ${rupees(offerAmount)}. 🎉`
            : "You have successfully booked a seat! 🎉",
        });
      } else {
        const errorText = await res.text();
        if (offerAmount) {
          setOfferError(errorText || "Offer not accepted.");
        } else {
          toast.add({
            type: "error",
            description: failMessage(
              res.status,
              errorText,
              "Failed to book seat",
            ),
          });
        }
      }
    } catch (err) {
      console.error("Failed to book seat:", err);
      toast.add({
        type: "error",
        description:
          "Could not reach the backend (is it running? or blocked by CORS).",
      });
    }
  };

  // Check the offer on this page first, then let the server decide
  const handleOffer = () => {
    if (!ride) return;
    const amount = Number(offer);
    if (!offer || Number.isNaN(amount) || amount <= 0) {
      setOfferError("Enter the amount you want to pay.");
      return;
    }
    if (amount >= ride.price) {
      setOfferError(
        `That is the full price (${rupees(ride.price)}). Just tap Book seat.`,
      );
      return;
    }
    setOfferError("");
    handleBookSeat(amount);
  };

  const handleCancelBooking = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/rides/${id}/cancel`, {
        method: "PUT",
      });

      if (res.ok) {
        await refreshRide();
        toast.add({
          type: "info",
          description: "Booking cancelled successfully. Seat freed up.",
        });
      } else {
        const errorText = await res.text();
        toast.add({
          type: "error",
          description: failMessage(
            res.status,
            errorText,
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

  const handleRequestStop = async () => {
    if (!isSignedIn) {
      toast.add({
        type: "error",
        description: "Please sign in to ask for a stop.",
      });
      return;
    }
    if (!stopPlace.trim()) {
      toast.add({
        type: "error",
        description: "Type the place you want to be picked up from.",
      });
      return;
    }

    try {
      const res = await authFetch(
        `${API_URL}/api/rides/${id}/stop-requests?place=${encodeURIComponent(stopPlace.trim())}&riderName=${encodeURIComponent(myName)}`,
        { method: "POST" },
      );
      if (res.ok) {
        await refreshRide();
        setStopPlace("");
        toast.add({
          type: "success",
          description: "Stop requested. The ride creator will see it.",
        });
      } else {
        toast.add({
          type: "error",
          description: (await res.text()) || "Could not request the stop.",
        });
      }
    } catch (err) {
      console.error("Failed to request stop:", err);
      toast.add({
        type: "error",
        description:
          "Could not reach the backend (is it running? or blocked by CORS).",
      });
    }
  };

  const handleWithdrawStop = async () => {
    try {
      const res = await authFetch(
        `${API_URL}/api/rides/${id}/stop-requests/${clerkUserId}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        await refreshRide();
        toast.add({ type: "info", description: "Stop request withdrawn." });
      }
    } catch (err) {
      console.error("Failed to withdraw stop:", err);
    }
  };

  if (loading) {
    return (
      <div className={pageClass}>
        <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
          <div className="h-10 w-32 animate-pulse rounded-full bg-m-surface-container" />
          <div className="h-80 animate-pulse rounded-m-card bg-m-surface-container" />
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className={pageClass}>
        <div className="mx-auto mt-10 max-w-md space-y-4 rounded-m-sheet border border-m-outline-variant bg-m-surface-low p-8">
          <p className="text-lg font-semibold text-m-error">Ride not found.</p>
          <p className="text-sm text-m-on-surface-variant">
            It may have been removed by the person who created it.
          </p>
          <button
            type="button"
            onClick={() => router.push("/rides")}
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-m-outline px-6 text-sm font-medium text-m-primary hover:bg-m-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary"
          >
            Back to all rides
          </button>
        </div>
      </div>
    );
  }

  const isAlreadyBooked = ride.passengerClerkIds?.includes(clerkUserId);
  const soldOut = ride.availableSeats <= 0;
  const isOwnRide = !!isSignedIn && ride.driverClerkId === clerkUserId;
  const myFare = ride.passengerFares?.[clerkUserId] ?? ride.price;
  const myStopRequest = ride.stopRequests?.find(
    (r) => r.riderClerkId === clerkUserId,
  );

  // Date and time shown separately, like a real boarding pass
  const departure = ride.departureTime ? new Date(ride.departureTime) : null;
  const dateText = departure
    ? departure.toLocaleDateString([], { dateStyle: "medium" })
    : "Not scheduled";
  const timeText = departure
    ? departure.toLocaleTimeString([], { timeStyle: "short" })
    : "—";

  // Everyone who booked this ride. Names come from `ride.passengerNames`;
  // bookings without a saved name show as "Passenger n".
  const passengerList = (ride.passengerClerkIds ?? []).map((cid, i) => {
    const isYou = cid === clerkUserId;
    const named = ride.passengerNames?.[cid];
    const name = isYou
      ? user?.fullName || user?.username || "You"
      : named || `Passenger ${i + 1}`;
    return { id: cid, name, isYou };
  });

  return (
    <div className={`${pageClass} pb-16`}>
      <main className="mx-auto max-w-3xl px-4 pt-6">
        <button
          type="button"
          onClick={() => router.push("/rides")}
          className="-ml-3 mb-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-medium text-m-primary transition-colors hover:bg-m-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          All rides
        </button>

        {/* Ticket */}
        <article className="relative flex flex-col sm:flex-row">
          {(isOwnRide || isAlreadyBooked) && (
            <div className="mt-6">
              <LiveTrackingCard rideId={ride.id} />
            </div>
          )}
          {/* Main section */}
          <div className="flex-1 overflow-hidden rounded-t-m-card border border-b-0 border-m-outline-variant bg-m-surface-low sm:rounded-l-m-card sm:rounded-tr-none sm:border-b sm:border-r-0">
            <div className="flex items-center justify-between bg-m-primary px-6 py-3 text-m-on-primary">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Car className="h-4 w-4" />
                {isAlreadyBooked ? "Boarding pass" : "Ride details"},{" "}
                {vehicleLabel(ride.vehicleType)}
              </span>
              {isAlreadyBooked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-m-accent px-2.5 py-0.5 text-xs font-medium text-white">
                  <Check className="h-3 w-3" />
                  Booked by you
                </span>
              )}
            </div>

            {/* Route: names wrap instead of being cut off */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-6 pt-6">
              <div className="min-w-0">
                <p className="text-xs text-m-on-surface-variant">From</p>
                <p className="break-words text-2xl font-semibold leading-tight sm:text-3xl">
                  {ride.origin}
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-7 text-m-primary">
                <span className="w-3 border-t-2 border-dashed border-current sm:w-6" />
                <Car className="h-5 w-5" />
                <span className="w-3 border-t-2 border-dashed border-current sm:w-6" />
              </div>
              <div className="min-w-0 text-right">
                <p className="text-xs text-m-on-surface-variant">To</p>
                <p className="break-words text-2xl font-semibold leading-tight sm:text-3xl">
                  {ride.destination}
                </p>
              </div>
            </div>

            {ride.stops && ride.stops.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2 px-6 text-sm">
                <span className="text-m-on-surface-variant">Via</span>
                {ride.stops.map((stop, i) => (
                  <span
                    key={i}
                    className="rounded-lg bg-m-surface-container px-2.5 py-1 font-medium"
                  >
                    {stop}
                  </span>
                ))}
              </div>
            )}

            {/* Date, time, seats */}
            <dl className="mt-6 grid grid-cols-3 gap-4 border-t-2 border-dashed border-m-outline-variant px-6 pt-5">
              <div>
                <dt className="text-xs text-m-on-surface-variant">Date</dt>
                <dd className="text-base font-semibold sm:text-lg">
                  {dateText}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-m-on-surface-variant">Time</dt>
                <dd className="text-base font-semibold sm:text-lg">
                  {timeText}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-m-on-surface-variant">
                  Seats left
                </dt>
                <dd
                  className={`text-base font-semibold sm:text-lg ${soldOut ? "text-m-error" : ""}`}
                >
                  {ride.availableSeats}
                </dd>
              </div>
            </dl>

            {/* Created by */}
            <div className="flex items-center gap-3 px-6 pb-6 pt-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-m-primary-container text-sm font-medium text-m-on-primary-container">
                {ride.driverName?.charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-m-on-surface-variant">Created by</p>
                <p className="truncate font-medium">{ride.driverName}</p>
              </div>
            </div>
          </div>

          {/* Stub */}
          <div className="relative flex flex-col gap-5 rounded-b-m-card border border-t-0 border-m-outline-variant bg-m-surface-low p-6 sm:w-64 sm:rounded-bl-none sm:rounded-r-m-card sm:border-l-0 sm:border-t">
            {/* perforation + notches */}
            <span className="pointer-events-none absolute inset-x-4 top-0 border-t-2 border-dashed border-m-outline-variant sm:inset-x-auto sm:inset-y-4 sm:left-0 sm:border-l-2 sm:border-t-0" />
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-m-surface" />
            <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-m-surface sm:-bottom-3 sm:-left-3 sm:right-auto sm:top-auto" />

            <div>
              <p className="text-xs text-m-on-surface-variant">
                {isAlreadyBooked ? "Your fare" : "Price per person"}
              </p>
              <p className="text-4xl font-semibold text-m-primary">
                {rupees(isAlreadyBooked ? myFare : ride.price)}
              </p>
              {ride.totalFare && ride.totalSeats && (
                <p className="mt-1 text-xs text-m-on-surface-variant">
                  {rupees(ride.totalFare)} for {ride.totalSeats} riders
                </p>
              )}
            </div>

            {isAlreadyBooked ? (
              <div className="space-y-2">
                <Barcode seed={ride.id} />
                <p className="text-xs text-m-on-surface-variant">
                  Show this pass at pickup
                </p>
              </div>
            ) : (
              <p className="text-sm text-m-on-surface-variant">
                {soldOut
                  ? "All seats are taken."
                  : `${ride.availableSeats} ${ride.availableSeats === 1 ? "seat" : "seats"} available`}
              </p>
            )}

            {/* Phone numbers: the backend decides what each person may see */}
            <RideContacts
              key={ride.passengerClerkIds?.length ?? 0}
              rideId={ride.id}
            />

            {/* Bargain box */}
            {!isAlreadyBooked &&
              !isOwnRide &&
              !soldOut &&
              ride.bargainEnabled && (
                <div className="space-y-2 rounded-lg bg-m-surface-container p-3">
                  <label
                    htmlFor="offer"
                    className="text-xs font-medium text-m-on-surface-variant"
                  >
                    Make an offer (per person)
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-m-on-surface-variant">
                        ₹
                      </span>
                      <input
                        id="offer"
                        type="number"
                        inputMode="numeric"
                        value={offer}
                        onChange={(e) => {
                          setOffer(e.target.value);
                          setOfferError("");
                        }}
                        placeholder={String(Math.round(ride.price))}
                        className={`${smallInput} pl-7`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleOffer}
                      className={smallButton}
                    >
                      Offer
                    </button>
                  </div>
                  {offerError && (
                    <p
                      role="alert"
                      className="text-xs font-medium text-m-error"
                    >
                      {offerError}
                    </p>
                  )}
                </div>
              )}

            <div className="mt-auto space-y-2">
              {isAlreadyBooked ? (
                <button
                  type="button"
                  className={btnOutlinedError}
                  onClick={handleCancelBooking}
                >
                  Cancel booking
                </button>
              ) : (
                <button
                  type="button"
                  className={btnFilled}
                  onClick={() => handleBookSeat()}
                  disabled={soldOut || isOwnRide}
                >
                  {isOwnRide
                    ? "Your ride"
                    : soldOut
                      ? "Sold out"
                      : `Book seat for ${rupees(ride.price)}`}
                </button>
              )}
              <p className="text-center text-xs text-m-on-surface-variant">
                Ride #{ride.id}
              </p>
            </div>
          </div>
        </article>

        {/* Route and stop requests */}
        <section className="mt-6 space-y-5 rounded-m-sheet border border-m-outline-variant bg-m-surface-low p-6">
          <div>
            <h2 className="text-lg font-semibold">Route</h2>
            <ol className="mt-3 space-y-2">
              {routeOf(ride).map((place, i, all) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 ${i === all.length - 1 ? "" : "rounded-full"
                      } bg-m-primary`}
                  />
                  <span className="font-medium">{place}</span>
                  {i === 0 && (
                    <span className="text-xs text-m-on-surface-variant">
                      start
                    </span>
                  )}
                  {i === all.length - 1 && (
                    <span className="text-xs text-m-on-surface-variant">
                      end
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="border-t border-m-outline-variant pt-5">
            <h3 className="font-semibold">Going the same way?</h3>

            {isOwnRide ? (
              <p className="mt-1 text-sm text-m-on-surface-variant">
                {ride.stopRequests && ride.stopRequests.length > 0
                  ? `${ride.stopRequests.length} stop request(s) waiting. Accept or decline them in your Console.`
                  : "Riders can ask you to add a stop. Requests will show up in your Console."}
              </p>
            ) : !isSignedIn ? (
              <p className="mt-1 text-sm text-m-on-surface-variant">
                Sign in to ask for a stop on this ride.
              </p>
            ) : myStopRequest ? (
              <div className="mt-2 flex flex-col gap-3 rounded-lg bg-m-surface-container p-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  You asked for <strong>{myStopRequest.place}</strong>. Waiting
                  for {ride.driverName} to accept.
                </p>
                <button
                  type="button"
                  onClick={handleWithdrawStop}
                  className="inline-flex h-9 cursor-pointer items-center justify-center rounded-full border border-m-outline px-4 text-sm font-medium text-m-primary hover:bg-m-surface-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary"
                >
                  Withdraw
                </button>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-m-on-surface-variant">
                  Is your place on the way from {ride.origin} to{" "}
                  {ride.destination}? Ask {ride.driverName} to add it as a stop.
                </p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={stopPlace}
                    onChange={(e) => setStopPlace(e.target.value)}
                    placeholder="Your stop (e.g. Ludhiana)"
                    aria-label="Your stop"
                    className={`${smallInput} bg-m-surface-container`}
                  />
                  <button
                    type="button"
                    onClick={handleRequestStop}
                    className={smallButton}
                  >
                    Request stop
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Passengers */}
        <section className="mt-6 rounded-m-sheet border border-m-outline-variant bg-m-surface-low p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Passengers ({passengerList.length})
          </h2>
          {passengerList.length === 0 ? (
            <p className="text-m-on-surface-variant">
              No one has booked a seat on this ride yet.
            </p>
          ) : (
            <ul className="divide-y divide-m-outline-variant">
              {passengerList.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-m-primary-container text-sm font-medium text-m-on-primary-container">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {p.name}
                  </span>
                  {p.isYou && (
                    <span className="rounded-full bg-m-primary-container px-2.5 py-0.5 text-xs font-medium text-m-on-primary-container">
                      You
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default function RideDetailsPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className={pageClass}>
          <div className="mx-auto max-w-3xl space-y-4 px-4 pt-6">
            <div className="h-10 w-32 animate-pulse rounded-full bg-m-surface-container" />
            <div className="h-80 animate-pulse rounded-m-card bg-m-surface-container" />
          </div>
        </div>
      }
    >
      <RideDetailsContent {...props} />
    </Suspense>
  );
}
