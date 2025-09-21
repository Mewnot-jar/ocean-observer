'use client';
import 'leaflet/dist/leaflet.css';
import dynamic from 'next/dynamic';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { FeatureCollection, Feature, Point } from 'geojson';
import type { LatLngExpression, LatLng, Layer, CircleMarker } from 'leaflet';
import { supabase } from '@/lib/supabaseClient';

/* =========================
   Tipos de tus observaciones
   ========================= */
type Activity = 'buceo' | 'pesca' | 'navegacion' | 'otros';

type ObsProps = {
  id: string;
  species_id: number | null;
  species_common?: string | null;
  activity: Activity;
  depth_min_m?: number | null;
  depth_max_m?: number | null;
  temperature_c?: number | null;
  notes?: string | null;
  observed_at: string;
  is_private: boolean;
};

type ObsFeature = Feature<Point, ObsProps>;
type ObsFC = FeatureCollection<Point, ObsProps>;

/* ============================================
   Tipos mínimos para los componentes dinámicos
   ============================================ */
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
  data: ObsFC;
  pointToLayer?: (feature: ObsFeature, latlng: LatLng) => Layer;
  onEachFeature?: (feature: ObsFeature, layer: Layer) => void;
};

/* =================================
   Imports dinámicos (solo en cliente)
   ================================= */
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

/* =================
   Página principal
   ================= */
export default function HomePage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [data, setData] = useState<ObsFC | null>(null);
  const [Llib, setLlib] = useState<typeof import('leaflet') | null>(null); // Leaflet runtime

  // Render solo tras montar (evita SSR issues)
  useEffect(() => { setMounted(true); }, []);

  // Carga Leaflet en cliente
  useEffect(() => {
    if (!mounted) return;
    void import('leaflet').then((leaflet) => setLlib(leaflet));
  }, [mounted]);

  // Trae datos
  useEffect(() => {
  if (!mounted) return;
  (async () => {
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const url = token ? '/api/observations?include=mine' : '/api/observations';
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const fc = (await res.json()) as ObsFC;
    setData(fc);
  })();
}, [mounted]);

  if (!mounted) return <main className="p-4">Cargando mapa…</main>;

  // Helpers de estilo / popup
  const colorByActivity = (a?: Activity): string =>
    ({ buceo: '#2563eb', pesca: '#16a34a', navegacion: '#f59e0b', otros: '#6b7280' }[a ?? 'otros']);

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
      </div>
    `;
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de observaciones</h1>
      <div className="h-[70vh] w-full rounded-2xl overflow-hidden border">
        <MapContainer center={[-20.2, -70.1]} zoom={11} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          {data && Llib && (
            <GeoJSON
              data={data}
              pointToLayer={(feature, latlng) =>
                Llib.circleMarker(latlng, {
                  radius: radiusByDepth(feature.properties.depth_min_m, feature.properties.depth_max_m),
                  weight: 2,
                  opacity: 1,
                  fillOpacity: 0.7,
                  color: colorByActivity(feature.properties.activity),
                })
              }
              onEachFeature={(feature, layer) => {
                (layer as CircleMarker).bindPopup(popupHtml(feature));
              }}
            />
          )}
        </MapContainer>
      </div>
    </main>
  );
}
