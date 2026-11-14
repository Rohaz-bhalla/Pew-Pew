"use client";

import { useAuth } from "@clerk/nextjs";
import { Client } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";

export type Participant = {
  userId: string;
  name: string;
  role: "DRIVER" | "PASSENGER";
  latitude: number;
  longitude: number;
  updatedAt: number;
  distanceKm: number | null;
  etaMinutes: number | null;
};

export type TrackingSnapshot = {
  rideId: number;
  viewerRole: "DRIVER" | "PASSENGER";
  participants: Participant[];
  serverTime: number;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const WS_URL = API.replace(/^http/, "ws") + "/ws";
const SEND_EVERY_MS = 4000; // throttle: saves battery and bandwidth

export function useLiveTracking(rideId: number) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  const [snapshot, setSnapshot] = useState<TrackingSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<Client | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);

  // 1) Load the current state (REST) and open the live connection (WebSocket)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await getTokenRef.current();
        const res = await fetch(`${API}/api/rides/${rideId}/tracking`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (res.ok) setSnapshot(await res.json());
        else if (res.status === 403)
          setError("Only the driver and booked riders can see live location.");
      } catch {
        /* the WebSocket below will still try */
      }
    })();

    const client = new Client({
      brokerURL: WS_URL,
      reconnectDelay: 5000,
      // Clerk tokens expire quickly, so fetch a fresh one on every (re)connect
      beforeConnect: async (c) => {
        const token = await getTokenRef.current();
        c.connectHeaders = { Authorization: `Bearer ${token}` };
      },
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/user/queue/rides/${rideId}/tracking`, (msg) =>
          setSnapshot(JSON.parse(msg.body)),
        );
      },
      onWebSocketClose: () => setConnected(false),
      onStompError: (frame) =>
        setError(frame.headers["message"] ?? "Live connection was refused."),
    });
    client.activate();
    clientRef.current = client;

    return () => {
      cancelled = true;
      client.deactivate();
    };
  }, [rideId]);

  // 2) Stop reading GPS when the page closes
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // 3) Share my own location (only after the user clicks the button)
  const startSharing = useCallback(() => {
    if (!navigator.geolocation) {
      setError("This browser cannot share location.");
      return;
    }
    setError(null);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const client = clientRef.current;
        if (now - lastSentRef.current < SEND_EVERY_MS || !client?.connected)
          return;
        lastSentRef.current = now;
        client.publish({
          destination: `/app/rides/${rideId}/location`,
          body: JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        });
      },
      (err) =>
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Allow it in your browser settings."
            : "Could not read your location.",
        ),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
    setSharing(true);
  }, [rideId]);

  const stopSharing = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setSharing(false);
    const client = clientRef.current;
    if (client?.connected) {
      client.publish({
        destination: `/app/rides/${rideId}/location/stop`,
        body: "",
      });
    }
  }, [rideId]);

  return { snapshot, connected, sharing, error, startSharing, stopSharing };
}
