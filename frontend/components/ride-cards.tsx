"use client";

import {
  ArrowRight,
  CalendarIcon,
  Car,
  Check,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { rupees, vehicleLabel, type Ride } from "@/lib/ride-utils";

// Colors, radii and font come from the theme tokens in globals.css.

const btnBase =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary disabled:cursor-not-allowed disabled:border-transparent disabled:bg-m-disabled disabled:text-m-on-disabled";
const btnFilled = `${btnBase} bg-m-primary text-m-on-primary hover:bg-m-primary-hover`;
const btnOutlinedError = `${btnBase} border border-m-error bg-transparent text-m-error hover:bg-m-error-container`;
const btnTextError = `${btnBase} px-3 text-m-error hover:bg-m-error-container`;

export type RideCardProps = {
  ride: Ride;
  isOwner: boolean;
  fare: number; // what the signed-in user pays (their booked fare, or the listed price)
  formattedDate: string | null;
  onOpen: () => void;
  onBook: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

/** Small "Pool car" / "E-rickshaw" label */
export function VehicleChip({ type }: { type?: string }) {
  const Icon = type === "E_RICKSHAW" ? Zap : Car;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-m-surface-container px-2.5 py-1 text-xs font-medium text-m-on-surface">
      <Icon className="h-3.5 w-3.5" />
      {vehicleLabel(type)}
    </span>
  );
}

// Deterministic pseudo-barcode (same on server and client, so no hydration mismatch)
export function Barcode({ seed }: { seed: number }) {
  const bars = Array.from({ length: 30 }, (_, i) => {
    let h = Math.imul(seed + 1, 73856093) ^ Math.imul(i + 1, 19349663);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return 1 + ((h >>> 0) % 3);
  });
  return (
    <div aria-hidden className="flex h-9 items-stretch gap-0.5">
      {bars.map((w, i) => (
        <span key={i} className="bg-m-on-surface" style={{ width: w }} />
      ))}
    </div>
  );
}

/** Booked ride -> boarding pass */
export function RideTicket({
  ride,
  isOwner,
  fare,
  formattedDate,
  onOpen,
  onCancel,
  onDelete,
}: RideCardProps) {
  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      className="relative flex cursor-pointer flex-col focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-m-primary sm:flex-row"
    >
      {/* Main section */}
      <div className="flex-1 overflow-hidden rounded-t-m-card border border-b-0 border-m-outline-variant bg-m-surface-low sm:rounded-l-m-card sm:rounded-tr-none sm:border-b sm:border-r-0">
        <div className="flex items-center justify-between bg-m-primary px-5 py-2.5 text-m-on-primary">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Car className="h-4 w-4" />
            Boarding pass, {vehicleLabel(ride.vehicleType)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-m-accent px-2.5 py-0.5 text-xs font-medium text-white">
            <Check className="h-3 w-3" />
            Booked by you
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 px-5 pt-5">
          <div className="min-w-0">
            <p className="text-xs text-m-on-surface-variant">From</p>
            <p className="break-words text-2xl font-semibold leading-tight">
              {ride.origin}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-6 text-m-primary">
            <span className="w-4 border-t-2 border-dashed border-current sm:w-8" />
            <Car className="h-5 w-5" />
            <span className="w-4 border-t-2 border-dashed border-current sm:w-8" />
          </div>
          <div className="min-w-0 text-right">
            <p className="text-xs text-m-on-surface-variant">To</p>
            <p className="break-words text-2xl font-semibold leading-tight">
              {ride.destination}
            </p>
          </div>
        </div>

        {ride.stops && ride.stops.length > 0 && (
          <p className="truncate px-5 pt-3 text-sm text-m-on-surface-variant">
            via {ride.stops.join(", ")}
          </p>
        )}

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t-2 border-dashed border-m-outline-variant px-5 py-4">
          <div className="min-w-0">
            <dt className="text-xs text-m-on-surface-variant">Departure</dt>
            <dd className="text-sm font-medium">
              {formattedDate ?? "Not scheduled"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-m-on-surface-variant">Created by</dt>
            <dd className="truncate text-sm font-medium">{ride.driverName}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-m-on-surface-variant">Seats left</dt>
            <dd className="text-sm font-medium">{ride.availableSeats}</dd>
          </div>
        </dl>
      </div>

      {/* Stub */}
      <div className="relative flex flex-col gap-4 rounded-b-m-card border border-t-0 border-m-outline-variant bg-m-surface-low p-5 sm:w-56 sm:rounded-bl-none sm:rounded-r-m-card sm:border-l-0 sm:border-t">
        {/* perforation + notches */}
        <span className="pointer-events-none absolute inset-x-4 top-0 border-t-2 border-dashed border-m-outline-variant sm:inset-x-auto sm:inset-y-4 sm:left-0 sm:border-l-2 sm:border-t-0" />
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-m-surface" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-m-surface sm:-bottom-3 sm:-left-3 sm:right-auto sm:top-auto" />

        <div className="flex items-end justify-between sm:block">
          <div>
            <p className="text-xs text-m-on-surface-variant">Your fare</p>
            <p className="text-3xl font-semibold text-m-primary">
              {rupees(fare)}
            </p>
          </div>
          <div className="space-y-1 sm:mt-4">
            <Barcode seed={ride.id} />
            <p className="text-xs text-m-on-surface-variant">Ride #{ride.id}</p>
          </div>
        </div>

        <div
          className="mt-auto flex flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={onOpen} className={btnFilled}>
            View details
          </button>
          <button type="button" onClick={onCancel} className={btnOutlinedError}>
            Cancel booking
          </button>
          {isOwner && (
            <button type="button" onClick={onDelete} className={btnTextError}>
              <Trash2 className="h-4 w-4" />
              Delete ride
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** Ride you have not booked -> compact card */
export function RideRow({
  ride,
  isOwner,
  formattedDate,
  onOpen,
  onBook,
  onDelete,
}: RideCardProps) {
  const soldOut = ride.availableSeats <= 0;

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      className="flex cursor-pointer flex-col gap-4 rounded-m-card border border-m-outline-variant bg-m-surface-low p-5 transition-colors hover:bg-m-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 space-y-3">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <span className="truncate">{ride.origin}</span>
          <ArrowRight className="h-4 w-4 shrink-0 text-m-primary" />
          <span className="truncate">{ride.destination}</span>
        </p>
        {ride.stops && ride.stops.length > 0 && (
          <p className="truncate text-sm text-m-on-surface-variant">
            via {ride.stops.join(", ")}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm text-m-on-surface-variant">
          <span className="flex items-center gap-2 pr-1">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-m-primary-container text-xs font-medium text-m-on-primary-container">
              {ride.driverName?.charAt(0).toUpperCase() || "?"}
            </span>
            Created by {ride.driverName}
          </span>
          <VehicleChip type={ride.vehicleType} />
          {formattedDate && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-m-surface-container px-2.5 py-1 text-xs font-medium text-m-on-surface">
              <CalendarIcon className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium",
              soldOut
                ? "bg-m-error-container text-m-on-error-container"
                : "bg-m-primary-container text-m-on-primary-container",
            )}
          >
            <Users className="h-3.5 w-3.5" />
            {soldOut
              ? "Sold out"
              : `${ride.availableSeats} ${ride.availableSeats === 1 ? "seat" : "seats"} left`}
          </span>
          {ride.bargainEnabled && !soldOut && (
            <span className="rounded-lg bg-m-surface-container px-2.5 py-1 text-xs font-medium text-m-primary">
              Open to offers
            </span>
          )}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:text-right">
          <p className="text-2xl font-semibold text-m-primary">
            {rupees(ride.price)}
          </p>
          <p className="text-xs text-m-on-surface-variant">per person</p>
        </div>
        <div className="flex items-center gap-1">
          {isOwner && (
            <button type="button" onClick={onDelete} className={btnTextError}>
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onBook}
            disabled={soldOut || isOwner}
            className={btnFilled}
          >
            {isOwner ? "Your ride" : soldOut ? "Sold out" : "Book seat"}
          </button>
        </div>
      </div>
    </article>
  );
}
