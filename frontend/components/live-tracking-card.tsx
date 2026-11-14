"use client";

import dynamic from "next/dynamic";
import { Navigation, Radio } from "lucide-react";
import { useLiveTracking } from "@/lib/use-live-tracking";

// Leaflet touches `window`, so it must only load in the browser
const LiveMap = dynamic(() => import("./live-map"), {
  ssr: false,
  loading: () => (
    <div className="h-80 animate-pulse rounded-m-card bg-m-surface-container" />
  ),
});

const btn =
  "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-m-primary";

const time = (ms: number) => new Date(ms).toLocaleTimeString();

export function LiveTrackingCard({ rideId }: { rideId: number }) {
  const { snapshot, connected, sharing, error, startSharing, stopSharing } =
    useLiveTracking(rideId);

  const participants = snapshot?.participants ?? [];
  const driver = participants.find((p) => p.role === "DRIVER");
  const riders = participants.filter((p) => p.role === "PASSENGER");
  const viewerIsDriver = snapshot?.viewerRole === "DRIVER";

  return (
    <section className="space-y-4 rounded-m-card border border-m-outline-variant bg-m-surface-low p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Navigation className="h-5 w-5 text-m-primary" />
          Live location
        </h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
            connected
              ? "bg-m-primary-container text-m-on-primary-container"
              : "bg-m-surface-container text-m-on-surface-variant"
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-m-error-container px-3 py-2 text-sm text-m-on-error-container"
        >
          {error}
        </p>
      )}

      <LiveMap participants={participants} />

      {/* Distance details */}
      {viewerIsDriver ? (
        riders.length > 0 ? (
          <ul className="divide-y divide-m-outline-variant text-sm">
            {riders.map((r) => (
              <li
                key={r.userId}
                className="flex items-center justify-between py-2"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-m-on-surface-variant">
                  {r.distanceKm !== null
                    ? `${r.distanceKm} km · ~${r.etaMinutes} min`
                    : "Distance unknown"}
                  {" · "}
                  {time(r.updatedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-m-on-surface-variant">
            No rider is sharing a location yet.
          </p>
        )
      ) : driver ? (
        <p className="text-sm">
          <span className="font-medium">{driver.name}</span> is{" "}
          {riders[0]?.distanceKm != null ? (
            <>
              <span className="font-semibold text-m-primary">
                {riders[0].distanceKm} km
              </span>{" "}
              away (~{riders[0].etaMinutes} min). Updated{" "}
              {time(driver.updatedAt)}.
            </>
          ) : (
            "sharing a location. Share yours to see the distance."
          )}
        </p>
      ) : (
        <p className="text-sm text-m-on-surface-variant">
          Waiting for the driver to share their location.
        </p>
      )}

      {/* Opt-in sharing */}
      {sharing ? (
        <button
          type="button"
          onClick={stopSharing}
          className={`${btn} border border-m-error bg-transparent text-m-error hover:bg-m-error-container`}
        >
          Stop sharing my location
        </button>
      ) : (
        <button
          type="button"
          onClick={startSharing}
          disabled={!connected}
          className={`${btn} bg-m-primary text-m-on-primary hover:bg-m-primary-hover disabled:cursor-not-allowed disabled:bg-m-disabled disabled:text-m-on-disabled`}
        >
          Share my live location
        </button>
      )}
      <p className="text-xs text-m-on-surface-variant">
        Your location is shared only with people on this ride, only while
        sharing is on.
      </p>
    </section>
  );
}
