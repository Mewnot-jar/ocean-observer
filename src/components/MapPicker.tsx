// src/components/MapPicker.tsx
'use client';

import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useMapEvents } from 'react-leaflet';
import type {
  Icon,
  LatLngExpression,
  LatLngLiteral,
  LatLng,
  Marker as LMarker,
  LeafletEvent,
  LeafletEventHandlerFnMap,
} from 'leaflet';
import type { CSSProperties, ReactNode } from 'react';

// ================= Tipos para los dynamic() =================
type MapContainerDynProps = {
  center: LatLngExpression;
  zoom?: number;
  style?: CSSProperties;
  children?: ReactNode;
};
type TileLayerDynProps = {
  url: string;
  attribution?: string;
};
type MarkerDynProps = {
  position: LatLngExpression;
  draggable?: boolean;
  icon?: Icon;
  eventHandlers?: LeafletEventHandlerFnMap;
};

// ================= React-Leaflet solo en cliente =================
const MapContainer = dynamic<MapContainerDynProps>(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic<TileLayerDynProps>(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic<MarkerDynProps>(
  () => import('react-leaflet').then((m) => m.Marker),
  { ssr: false }
);

// Captura click en el mapa y devuelve el Lat/Lng
function ClickHandler({ onClick }: { onClick: (p: LatLngLiteral) => void }) {
  useMapEvents({
    click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

// ================= API del componente =================
export type MapPickerProps = {
  value: LatLngLiteral | null;
  onChange: (pos: LatLngLiteral | null) => void;
  center?: LatLngExpression;
  zoom?: number;
  className?: string;
  showUseMyLocation?: boolean;
};

export default function MapPicker({
  value,
  onChange,
  center = [-20.2, -70.1],
  zoom = 11,
  className,
  showUseMyLocation = true,
}: MapPickerProps) {
  const [markerKey, setMarkerKey] = useState(0);
  useEffect(() => setMarkerKey((k) => k + 1), [value?.lat, value?.lng]);

  // Icono de Leaflet creado con import dinámico (evita SSR "window is not defined")
  const [markerIcon, setMarkerIcon] = useState<Icon | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const L = (await import('leaflet')).default;
      const icon = L.icon({
        // Si prefieres archivos locales: /leaflet/marker-icon.png, etc.
        iconUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl:
          'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41],
      });
      if (alive) setMarkerIcon(icon);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function setMyLocation() {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => alert('No pudimos obtener tu ubicación.')
    );
  }

  // Handlers de Leaflet tipados (sin any)
  const dragHandlers: LeafletEventHandlerFnMap = {
    dragend: (e: LeafletEvent) => {
      const marker = e.target as LMarker;
      const p = marker.getLatLng();
      onChange({ lat: p.lat, lng: p.lng });
    },
  };

  return (
    <div className={className}>
      <div className="mb-2 flex gap-2">
        {showUseMyLocation && (
          <button
            type="button"
            onClick={setMyLocation}
            className="border rounded px-3 py-1 text-sm hover:bg-zinc-50"
          >
            Usar mi ubicación
          </button>
        )}
        {value && (
          <span className="text-xs text-zinc-600 self-center">
            lat: {value.lat.toFixed(5)} · lng: {value.lng.toFixed(5)}
          </span>
        )}
      </div>

      <div className="h-72 w-full rounded-2xl overflow-hidden border relative">
        <MapContainer
          center={value ?? center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />

          <ClickHandler onClick={onChange} />

          {value && markerIcon && (
            <Marker
              key={markerKey}
              icon={markerIcon}
              draggable
              position={value as LatLng}
              eventHandlers={dragHandlers}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
