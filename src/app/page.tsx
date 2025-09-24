// src/app/page.tsx
'use client';

import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import type { CSSProperties, ReactNode } from 'react';
import type {
  Feature,
  FeatureCollection,
  GeoJsonObject,
  Point as GJPoint,
} from 'geojson';
import type {
  LatLngExpression,
  LatLng,
  Layer,
  CircleMarker,
} from 'leaflet';

// ====== Tipos de datos (observaciones) ======
type Activity = 'buceo' | 'pesca' | 'navegacion' | 'otros';

type ObsProps = {
  id: string;
  species_id: number | null;
  species_common?: string | null;
  activity: Activity;
  depth_min_m?: number | null;
  depth_max_m?: number | null;
  temperature_c?: number | null;
  observed_at: string; // ISO
  is_private: boolean;
};

type ObsFeature = Feature<GJPoint, ObsProps>;
type ObsFC = FeatureCollection<GJPoint, ObsProps>;

// ====== Tipos mínimos para los dynamic() ======
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
type GeoJSONDynProps = {
  data: GeoJsonObject;
  pointToLayer?: (feature: ObsFeature, latlng: LatLng) => Layer;
  onEachFeature?: (feature: ObsFeature, layer: Layer) => void;
};

// ====== React-Leaflet solo en cliente (con tipos) ======
const MapContainer = dynamic<MapContainerDynProps>(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic<TileLayerDynProps>(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic<GeoJSONDynProps>(
  () => import('react-leaflet').then((m) => m.GeoJSON),
  { ssr: false }
);

// ====== Helpers UI ======
const colorByActivity = (a?: Activity): string =>
  ({
    buceo: '#2563eb',
    pesca: '#16a34a',
    navegacion: '#f59e0b',
    otros: '#6b7280',
  }[a ?? 'otros']);

const radiusByDepth = (min?: number | null, max?: number | null): number => {
  const d = Math.max(0, Number(max ?? min ?? 0));
  return Math.min(12, 4 + d * 0.2);
};

const popupHtml = (f: ObsFeature): string => {
  const p = f.properties;
  return `
    <div style="min-width:180px">
      <strong>${p.species_common ?? 'Sin especie'}</strong><br/>
      Act.: ${p.activity ?? '-'}<br/>
      Prof.: ${p.depth_min_m ?? '-'}–${p.depth_max_m ?? '-'} m<br/>
      Temp.: ${p.temperature_c ?? '-'} °C<br/>
      Fecha: ${p.observed_at ? new Date(p.observed_at).toLocaleString() : '-'}
      ${p.is_private ? '<div style="color:#ef4444;margin-top:4px;">Privada</div>' : ''}
    </div>
  `;
};

// ====== Auto-centrado al usuario ======
function AutoLocate({
  fallbackCenter = [-20.2, -70.1],
  fallbackZoom = 11,
  userZoom = 12,
}: {
  fallbackCenter?: LatLngExpression;
  fallbackZoom?: number;
  userZoom?: number;
}) {
  const map = useMap();

  useEffect(() => {
    let alive = true;

    if (!('geolocation' in navigator)) {
      map.setView(fallbackCenter, fallbackZoom);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (!alive) return;
        const latlng: LatLngExpression = [coords.latitude, coords.longitude];
        map.setView(latlng, userZoom);

        try {
          const L = (await import('leaflet')).default;
          L.circleMarker(latlng, {
            radius: 6,
            color: '#2563eb',
            weight: 2,
            fillOpacity: 0.6,
          })
            .addTo(map)
            .bindTooltip('Estás aquí');
        } catch {
          /* no-op */
        }
      },
      () => map.setView(fallbackCenter, fallbackZoom),
      { enableHighAccuracy: true, timeout: 6000 }
    );

    return () => {
      alive = false;
    };
  }, [map, fallbackCenter, fallbackZoom, userZoom]);

  return null;
}

// Botón para recentrar manualmente
function LocateButton() {
  const map = useMap();

  const go = () => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => map.setView([coords.latitude, coords.longitude], 12),
      () => {}
    );
  };

  return (
    <div className="absolute right-3 top-3 z-[1000]">
      <button
        onClick={go}
        className="rounded border bg-white/90 px-2 py-1 text-sm shadow hover:bg-white"
      >
        📍 Mi ubicación
      </button>
    </div>
  );
}

// ====== Página ======
export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ObsFC | null>(null);
  const [Llib, setLlib] = useState<typeof import('leaflet') | null>(null);

  useEffect(() => {
    setMounted(true);
    import('leaflet').then((L) => setLlib(L));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const res = await fetch('/api/observations', { cache: 'no-store' });
      const js: ObsFC = await res.json();
      setData(js);
    })().catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Error cargando observaciones', err);
    });
  }, [mounted]);

  if (!mounted) return <main className="p-4">Cargando mapa…</main>;

  // Para evitar el "posible null" de Llib dentro de los callbacks del GeoJSON:
  const L = Llib as NonNullable<typeof Llib>;

  const mapStyle: CSSProperties = { height: '100%', width: '100%' };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de observaciones</h1>

      <div className="h-[70vh] w-full rounded-2xl overflow-hidden border relative">
        <MapContainer center={[-20.2, -70.1]} zoom={11} style={mapStyle}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />

          <AutoLocate />

          {data && Llib && (
            <GeoJSON
              data={data as unknown as GeoJsonObject}
              pointToLayer={(feature: ObsFeature, latlng: LatLng): Layer =>
                L.circleMarker(latlng, {
                  radius: radiusByDepth(
                    feature.properties.depth_min_m,
                    feature.properties.depth_max_m
                  ),
                  color: colorByActivity(feature.properties.activity),
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.7,
                })
              }
              onEachFeature={(feature: ObsFeature, layer: Layer): void => {
                (layer as CircleMarker).bindPopup(popupHtml(feature));
              }}
            />
          )}

          <LocateButton />
        </MapContainer>
      </div>
    </main>
  );
}
