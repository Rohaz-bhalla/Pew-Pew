"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { Participant } from "@/lib/use-live-tracking";

// Emoji markers avoid Leaflet's broken default-icon problem in Next.js
const emojiIcon = (emoji: string) =>
  L.divIcon({
    html: `<div style="font-size:28px;line-height:1">${emoji}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
const driverIcon = emojiIcon("🚗");
const riderIcon = emojiIcon("🧍");

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 15);
    else if (points.length > 1)
      map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
  }, [map, points]);
  return null;
}

export default function LiveMap({
  participants,
}: {
  participants: Participant[];
}) {
  const driver = participants.find((p) => p.role === "DRIVER");
  const riders = participants.filter((p) => p.role === "PASSENGER");
  const points = useMemo<[number, number][]>(
    () => participants.map((p) => [p.latitude, p.longitude]),
    [participants],
  );

  return (
    <MapContainer
      center={[22.97, 78.65]}
      zoom={5}
      scrollWheelZoom={false}
      className="isolate h-72 w-full rounded" // "isolate" keeps Leaflet below your sticky header
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <FitBounds points={points} />

      {driver && (
        <Marker
          position={[driver.latitude, driver.longitude]}
          icon={driverIcon}
        >
          <Popup>Driver: {driver.name}</Popup>
        </Marker>
      )}
      {riders.map((r) => (
        <div key={r.userId}>
          <Marker position={[r.latitude, r.longitude]} icon={riderIcon}>
            <Popup>
              {r.name}
              {r.distanceKm !== null && ` · ${r.distanceKm} km from driver`}
            </Popup>
          </Marker>
          {driver && (
            <Polyline
              positions={[
                [driver.latitude, driver.longitude],
                [r.latitude, r.longitude],
              ]}
              pathOptions={{ dashArray: "6 8" }}
            />
          )}
        </div>
      ))}
    </MapContainer>
  );
}
