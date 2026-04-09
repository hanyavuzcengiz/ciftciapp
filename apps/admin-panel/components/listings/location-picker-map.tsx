"use client";

import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";
import type React from "react";
import "leaflet/dist/leaflet.css";

function Picker(props: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => props.onPick(e.latlng.lat, e.latlng.lng)
  });
  return null;
}

export function LocationPickerMap(props: {
  value: { lat: number; lng: number };
  onChange: (lat: number, lng: number) => void;
}) {
  const AnyMapContainer = MapContainer as unknown as React.ComponentType<Record<string, unknown>>;
  const AnyTileLayer = TileLayer as unknown as React.ComponentType<Record<string, unknown>>;
  const AnyMarker = Marker as unknown as React.ComponentType<Record<string, unknown>>;
  const center: LatLngExpression = [props.value.lat, props.value.lng];
  return (
    <AnyMapContainer center={center} zoom={6} className="h-72 w-full rounded-xl">
      <AnyTileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <AnyMarker position={center} />
      <Picker onPick={props.onChange} />
    </AnyMapContainer>
  );
}
