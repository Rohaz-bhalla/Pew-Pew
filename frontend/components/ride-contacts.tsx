"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Phone } from "lucide-react";
import { useAuthFetch } from "@/lib/use-auth-fetch";

type Contacts =
  | {
      role: "DRIVER";
      passengers: { clerkId: string; name: string; phone: string | null }[];
    }
  | { role: "RIDER"; driverPhone: string | null };

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function PhoneLink({ phone }: { phone: string | null }) {
  if (!phone) return <span className="text-m-on-surface-variant">Not provided</span>;
  return (
    <a
      href={`tel:${phone}`}
      className="inline-flex items-center gap-1.5 font-medium text-m-primary underline underline-offset-2"
    >
      <Phone className="h-4 w-4" />
      {phone}
    </a>
  );
}

export function RideContacts({ rideId }: { rideId: number }) {
  const { isSignedIn } = useUser();
  const authFetch = useAuthFetch();
  const [data, setData] = useState<Contacts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/api/rides/${rideId}/contacts`);
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, rideId]);

  if (!isSignedIn) {
    return (
      <p className="text-sm text-m-on-surface-variant">
        Sign in to see the driver&apos;s phone number.
      </p>
    );
  }
  if (failed) {
    return <p className="text-sm text-m-error">Could not load contact details.</p>;
  }
  if (!data) return null;

  if (data.role === "RIDER") {
    return (
      <div className="space-y-1 text-sm">
        <p className="text-xs text-m-on-surface-variant">Driver&apos;s phone</p>
        <PhoneLink phone={data.driverPhone} />
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-m-on-surface-variant">Passenger contacts</p>
      {data.passengers.length === 0 ? (
        <p className="text-m-on-surface-variant">No bookings yet.</p>
      ) : (
        data.passengers.map((p) => (
          <div key={p.clerkId} className="flex items-center justify-between gap-3">
            <span>{p.name}</span>
            <PhoneLink phone={p.phone} />
          </div>
        ))
      )}
    </div>
  );
}