"use client";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { FeatureCollection, Feature, Point } from "geojson";
import type { LatLngExpression, LatLng, Layer, CircleMarker } from "leaflet";
import { supabase } from "@/lib/supabaseClient";
import { useMemo } from "react";

/* =========================
   Tipos de tus observaciones
   ========================= */
type Activity = "buceo" | "pesca" | "navegacion" | "otros";

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

type SpeciesRow = { id: number; common_name: string | null };
type ActivityFilter = Activity | "todos";

/* =================================
   Imports dinámicos (solo en cliente)
   ================================= */
const MapContainer = dynamic<MapContainerDynProps>(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic<TileLayerDynProps>(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic<GeoJSONDynProps>(
  () => import("react-leaflet").then((m) => m.GeoJSON),
  { ssr: false }
);

/* =================
   Página principal
   ================= */
export default function HomePage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [data, setData] = useState<ObsFC | null>(null);
  const [Llib, setLlib] = useState<typeof import("leaflet") | null>(null); // Leaflet runtime

  const [speciesList, setSpeciesList] = useState<SpeciesRow[]>([]);
  const [speciesId, setSpeciesId] = useState<number | null>(null);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("todos");

  const [geoVersion, setGeoVersion] = useState(0);

  // Render solo tras montar (evita SSR issues)
  useEffect(() => {
    setMounted(true);
  }, []);
  const filteredData = useMemo<ObsFC | null>(() => {
    if (!data) return null;
    if (activityFilter === "todos") return data;
    const features = data.features.filter(
      (f) => f.properties.activity === activityFilter
    );
    return { ...data, features };
  }, [data, activityFilter]);

  useEffect(() => {
    setGeoVersion((v) => v + 1);
  }, [speciesId, activityFilter, data]);

  // Carga Leaflet en cliente
  useEffect(() => {
    if (!mounted) return;
    void import("leaflet").then((leaflet) => setLlib(leaflet));
  }, [mounted]);

  // Trae datos
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;

      const params = new URLSearchParams();
      if (speciesId) params.set("species_id", String(speciesId));
      const base = "/api/observations";
      const hasParams = params.toString().length > 0;

      const url =
        base +
        (hasParams ? `?${params.toString()}` : "") +
        (token ? (hasParams ? "&" : "?") + "include=mine" : "");

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const fc = (await res.json()) as ObsFC;
      setData(fc);
    })();
  }, [mounted, speciesId]);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const { data } = await supabase
        .from("species")
        .select("id, common_name")
        .order("common_name", { ascending: true });
      setSpeciesList(data ?? []);
    })();
  }, [mounted]);

  if (!mounted) return <main className="p-4">Cargando mapa…</main>;

  // Helpers de estilo / popup
  const colorByActivity = (a?: Activity): string =>
    ({
      buceo: "#2563eb",
      pesca: "#16a34a",
      navegacion: "#f59e0b",
      otros: "#6b7280",
    }[a ?? "otros"]);

  const radiusByDepth = (min?: number | null, max?: number | null): number => {
    const d = Math.max(0, Number(max ?? min ?? 0));
    return Math.min(12, 4 + d * 0.2);
  };

  const popupHtml = (f: ObsFeature): string => {
    const p = f.properties;
    return `
      <div style="min-width:180px">
        <strong>${p.species_common ?? "Sin especie"}</strong><br/>
        Act.: ${p.activity ?? "-"}<br/>
        Prof.: ${p.depth_min_m ?? "-"}–${p.depth_max_m ?? "-"} m<br/>
        Temp.: ${p.temperature_c ?? "-"} °C<br/>
        Fecha: ${p.observed_at ? new Date(p.observed_at).toLocaleString() : "-"}
      </div>
    `;
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de observaciones</h1>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Especie</label>
          <select
            value={speciesId ?? ""}
            onChange={(e) =>
              setSpeciesId(e.target.value ? Number(e.target.value) : null)
            }
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="">Todas</option>
            {speciesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.common_name ?? `Especie ${s.id}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Actividad</label>
          <select
            value={activityFilter}
            onChange={(e) =>
              setActivityFilter(e.target.value as ActivityFilter)
            }
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="todos">Todas</option>
            <option value="buceo">Buceo</option>
            <option value="pesca">Pesca</option>
            <option value="navegacion">Navegación</option>
            <option value="otros">Otros</option>
          </select>
        </div>

        <button
          onClick={() => {
            setSpeciesId(null);
            setActivityFilter("todos");
          }}
          className="border rounded px-3 py-2 text-sm hover:bg-zinc-50"
          title="Limpiar filtros"
        >
          Limpiar
        </button>
      </div>
      <div className="h-[70vh] w-full rounded-2xl overflow-hidden border relative">
        <MapContainer
          center={[-20.2, -70.1]}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap"
          />
          <div className="absolute right-2 top-2 z-[1000] bg-white/90 rounded-md shadow p-2 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: "#2563eb" }}
              ></span>{" "}
              Buceo
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: "#16a34a" }}
              ></span>{" "}
              Pesca
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: "#f59e0b" }}
              ></span>{" "}
              Navegación
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: "#6b7280" }}
              ></span>{" "}
              Otros
            </div>
          </div>
          {data && Llib && (
            <GeoJSON
              key={geoVersion}
              data={(filteredData ?? data)!}
              pointToLayer={(feature, latlng) =>
                Llib.circleMarker(latlng, {
                  radius: radiusByDepth(
                    feature.properties.depth_min_m,
                    feature.properties.depth_max_m
                  ),
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
