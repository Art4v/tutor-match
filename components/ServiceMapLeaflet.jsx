"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const OSM = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap contributors",
};
const CARTO = {
  url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
  attribution: "&copy; OpenStreetMap &copy; CARTO",
};

function circleBounds(lat, lng, radiusKm) {
  const earth = 6371; // km
  const dLat = (radiusKm / earth) * (180 / Math.PI);
  const dLng = (radiusKm / (earth * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
  return [
    [lat - dLat, lng - dLng],
    [lat + dLat, lng + dLng],
  ];
}

function FitToCircle({ lat, lng, radiusKm }) {
  const map = useMap();
  useEffect(() => {
    const bounds = circleBounds(lat, lng, Math.max(0.5, radiusKm));
    map.fitBounds(bounds, { padding: [16, 16], animate: false });
  }, [map, lat, lng, radiusKm]);
  return null;
}

function FallbackOnError({ onFallback }) {
  const map = useMap();
  const errors = useRef(0);
  useEffect(() => {
    const handler = () => {
      errors.current += 1;
      if (errors.current > 3) onFallback();
    };
    map.on("tileerror", handler);
    return () => { map.off("tileerror", handler); };
  }, [map, onFallback]);
  return null;
}

export default function ServiceMapLeaflet({ lat, lng, radiusKm, compact = false }) {
  const [tiles, setTiles] = useState(OSM);
  const interaction = compact
    ? { scrollWheelZoom: false, dragging: false, doubleClickZoom: false, zoomControl: false, touchZoom: false, boxZoom: false, keyboard: false }
    : { scrollWheelZoom: false };

  const r = Math.max(0.5, Number(radiusKm) || 1);
  const center = useMemo(() => [lat, lng], [lat, lng]);

  // The wrapper's position+zIndex isolate Leaflet's internal high z-indexes
  // (panes 400, controls 1000) into their own stacking context, so the map can't
  // paint over the page's sticky nav / save bar / unsaved-changes banner.
  return (
    <div style={{ position: "relative", zIndex: 0, height: 200, borderRadius: 12, overflow: "hidden", border: "1px solid var(--desk)" }}>
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: "100%", width: "100%" }}
        {...interaction}
      >
        <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
        <Circle
          center={center}
          radius={r * 1000}
          pathOptions={{ color: "var(--ink)", weight: 1.25, dashArray: "4 4", fillColor: "var(--ink)", fillOpacity: 0.06 }}
        />
        <Circle
          center={center}
          radius={Math.max(40, r * 25)}
          pathOptions={{ color: "var(--ink)", weight: 0, fillColor: "var(--ink)", fillOpacity: 1 }}
        />
        <FitToCircle lat={lat} lng={lng} radiusKm={r} />
        <FallbackOnError onFallback={() => { if (tiles !== CARTO) setTiles(CARTO); }} />
      </MapContainer>
    </div>
  );
}

// Default-marker icon paths break under bundlers — clear them so Leaflet
// doesn't try to fetch broken PNGs when something incidentally adds a Marker.
if (typeof window !== "undefined" && L?.Icon?.Default?.prototype) {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "",
    iconUrl: "",
    shadowUrl: "",
  });
}
