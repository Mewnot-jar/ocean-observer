# Ocean Observer — v0.0.1

Mapa y registro (MVP) de observaciones marinas desde web móvil.  
Stack: **Next.js (App Router) + Tailwind + Supabase (Postgres+RLS) + Leaflet/react-leaflet**.

---

## ✨ Funcionalidades

- **/add**: formulario para crear observaciones (especie, actividad, profundidad, temperatura, notas, público/privado).
- **/**: mapa (Leaflet) con popups.  
  - Anónimos → ven **solo públicas**.  
  - Logueados → **públicas + privadas propias** (`include=mine`).
- **/my**: lista tus observaciones y **elimina** (borra también archivos de Storage si existen).
- **Navbar** con links (Mapa / Agregar / Mis observaciones) + login por **Magic Link**.

---

## 🧱 Requisitos

- Node 18+ / 20+
- Cuenta Supabase (DB + Auth + Storage)
- Vercel (deploy)

---

## 🔧 Configuración local

1) **Variables de entorno** (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

2) **Instalar y correr**
```bash
npm install
npm run dev
# http://localhost:3000
```

> Si usas TypeScript: `npm i -D @types/geojson`  
> Si una lib externa rompe el build: en `tsconfig.json` → `"skipLibCheck": true`.

---

## 🗺️ Rutas

- `/` → mapa de observaciones (GeoJSON + popups)
- `/add` → formulario de alta
- `/my` → mis observaciones (eliminar)

---

## 🗄️ Supabase (resumen de schema)

Tablas principales:
- `species (id, common_name, scientific_name)`
- `observations (id, user_id, species_id, activity, depth_min_m, depth_max_m, temperature_c, notes, observed_at, is_private, geom geography(Point,4326))`
- `observation_media (id, observation_id, storage_path, ... )` *(opcional en v0.0.1)*
- `profiles` (creada por trigger `handle_new_user`) *(opcional)*

### Políticas RLS recomendadas
```sql
-- Lectura: públicas o dueñas
create policy if not exists obs_read_public_or_owner
on public.observations for select
using (is_private = false or auth.uid() = user_id);

-- Inserción: solo el usuario autenticado asignándose a sí mismo
create policy if not exists obs_insert_self
on public.observations for insert
with check (auth.uid() = user_id);

-- Eliminación: solo dueñas
create policy if not exists obs_delete_own
on public.observations for delete
using (auth.uid() = user_id);
```

### RPC para GeoJSON (incluye privadas propias)
```sql
create or replace function public.observations_geojson(
  min_lon double precision default -180,
  min_lat double precision default -90,
  max_lon double precision default 180,
  max_lat double precision default 90,
  species_id_in int default null,
  from_ts timestamptz default null,
  to_ts timestamptz default null,
  min_depth numeric default null,
  max_depth numeric default null,
  include_private_for_user uuid default null
)
returns json language sql stable as $$
  select json_build_object(
    'type','FeatureCollection',
    'features', coalesce(json_agg(
      json_build_object(
        'type','Feature',
        'geometry', ST_AsGeoJSON(o.geom)::json,
        'properties', json_build_object(
          'id', o.id,
          'species_id', o.species_id,
          'species_common', s.common_name,
          'activity', o.activity,
          'depth_min_m', o.depth_min_m,
          'depth_max_m', o.depth_max_m,
          'temperature_c', o.temperature_c,
          'notes', o.notes,
          'observed_at', o.observed_at,
          'is_private', o.is_private
        )
      )
    ), '[]'::json)
  )
  from public.observations o
  left join public.species s on s.id = o.species_id
  where
    (o.is_private = false
     or (include_private_for_user is not null and o.user_id = include_private_for_user))
    and o.geom && ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
    and (species_id_in is null or o.species_id = species_id_in)
    and (from_ts is null or o.observed_at >= from_ts)
    and (to_ts is null or o.observed_at < to_ts)
    and (min_depth is null or o.depth_min_m >= min_depth)
    and (max_depth is null or o.depth_max_m <= max_depth);
$$;
```

---

## 🔌 API

- `GET /api/observations`  
  - Devuelve GeoJSON de públicas.  
  - Si envías `Authorization: Bearer <token>` **y** `?include=mine`, incluye las privadas del usuario.
  - Parámetros soportados (opcionales): `min_lon,min_lat,max_lon,max_lat,species_id,from,to,min_depth,max_depth`.

- `POST /api/observations`  
  - Crea una observación (requiere `Authorization: Bearer <token>`).  
  - El form de `/add` ya la usa.

- `DELETE /api/observations/[id]` *(opcional; v0.0.1 usa supabase client en `/my`)*

---

## 🌱 Semillas

**Especies**:
```sql
insert into public.species (common_name, scientific_name) values
('Loco','Concholepas concholepas'),
('Jurel','Trachurus murphyi'),
('Sardina común','Sardinops sagax'),
('Pulpo','Octopus mimus'),
('Jaiba mora','Cancer setosus'),
('Corvina','Cilus gilberti'),
('Anchoveta','Engraulis ringens'),
('Caballa','Scomber japonicus'),
('Merluza común','Merluccius gayi'),
('Huiro (alga)','Macrocystis pyrifera')
on conflict (common_name) do nothing;
```

**Observaciones de ejemplo (Iquique)**: ver `/docs/sql/seed_observations.sql` *(o el script que usaste durante el setup)*.

---

## 🚀 Deploy

### Supabase
- **Auth → URL Configuration**  
  - **Site URL**: `https://tuapp.vercel.app`  
  - **Additional redirect URLs**: agrega tu dominio y los de preview.

### Vercel (Git)
- Conecta el repo → **Environment Variables** (Production & Preview):  
  - `NEXT_PUBLIC_SUPABASE_URL`  
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Push a `main` → se despliega.

### Vercel (CLI)
```bash
npm i -g vercel
vercel login
vercel link
vercel        # preview
vercel --prod # producción
```

---

## 🧩 Notas técnicas

- **Leaflet en Next**: se importa con `dynamic(..., { ssr:false })` y `import 'leaflet/dist/leaflet.css'`.
- El mapa usa `GeoJSON` con `pointToLayer` y popups HTML.
- `/my` elimina observaciones y, si hay fotos, remueve archivos de Storage antes del `delete`.

---

## 🐞 Troubleshooting

- **“window is not defined / appendChild”** → react-leaflet debe cargarse **solo en cliente** (`dynamic` + `ssr:false`).
- **Build falla por `any`** → evita `any`, usa tipos de `geojson` (`npm i -D @types/geojson`).
- **No veo privadas** → estar logueado + fetch con `?include=mine` + `Authorization: Bearer <token>` + policy de `SELECT`.

---

## 📋 Roadmap corto

- Filtros (actividad/especie/fechas).
- Subida de fotos (Storage) y miniatura en popup.
- PWA (instalable offline).
- Carga por **bbox** y clustering.
- Roles “validador” y verificación de especies.

---

## 📝 Changelog

- **v0.0.1**  
  - Mapa con públicas y privadas propias.  
  - Alta `/add`.  
  - Gestión `/my` (eliminar + borra archivos de Storage).  
  - Navbar + login Magic Link.

---

