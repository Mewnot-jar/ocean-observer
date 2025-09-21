'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Activity = 'buceo' | 'pesca' | 'navegacion' | 'otros';

export default function ObservationForm() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [species, setSpecies] = useState('');
  const [activity, setActivity] = useState<Activity>('buceo');
  const [depthMin, setDepthMin] = useState('');
  const [depthMax, setDepthMax] = useState('');
  const [tempC, setTempC] = useState('');
  const [notes, setNotes] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [mode, setMode] = useState<'direct' | 'api'>('direct');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
  }, []);

  async function ensureLogged() {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    const email = prompt('Ingresa tu correo para enviarte un Magic Link:') || '';
    if (!email) return null;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) {
      alert('Error enviando link');
      return null;
    }
    alert('Revisa tu correo, abre el link y vuelve a esta página.');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    if (!coords) {
      alert('Activa el GPS primero');
      return;
    }

    const session = await ensureLogged();
    if (!session) return;

    // Construimos payload común
    const payload = {
      species_common: species || null,
      activity,
      depth_min_m: depthMin ? Number(depthMin) : null,
      depth_max_m: depthMax ? Number(depthMax) : null,
      temperature_c: tempC ? Number(tempC) : null,
      notes: notes || null,
      is_private: isPrivate,
      lat: coords.lat,
      lng: coords.lng,
    };

    try {
      if (mode === 'direct') {
        // Asegura species_id
        let finalSpeciesId: number | null = null;
        if (species) {
          const { data: found } = await supabase
            .from('species')
            .select('id')
            .ilike('common_name', species)
            .limit(1)
            .maybeSingle();
          if (found?.id) {
            finalSpeciesId = found.id;
          } else {
            const { data: ins } = await supabase
              .from('species')
              .insert({ common_name: species })
              .select('id')
              .single();
            finalSpeciesId = ins?.id ?? null;
          }
        }

        const userId = (await supabase.auth.getUser()).data.user?.id ?? null;
        const { data: obs, error } = await supabase
          .from('observations')
          .insert({
            user_id: userId,
            species_id: finalSpeciesId,
            activity: payload.activity,
            depth_min_m: payload.depth_min_m,
            depth_max_m: payload.depth_max_m,
            temperature_c: payload.temperature_c,
            notes: payload.notes,
            is_private: payload.is_private,
            geom: `SRID=4326;POINT(${payload.lng} ${payload.lat})`,
          })
          .select('id')
          .single();

        if (error) throw error;
        setStatus(`Creada (direct) id=${obs?.id}`);
      } else {
        // Inserción vía tu endpoint API (envía Bearer token)
        const res = await fetch('/api/observations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('API error');
        const js = await res.json();
        setStatus(`Creada (api) id=${js.id}`);
      }
    } catch (err) {
      console.error(err);
      alert('Error creando observación');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-3 p-4 border rounded-2xl">
      <h2 className="text-xl font-semibold">Nueva observación</h2>
      <div className="grid grid-cols-2 gap-3">
        <input
          className="border p-2 rounded"
          placeholder="Especie (común)"
          value={species}
          onChange={(e) => setSpecies(e.target.value)}
        />
        <select
          className="border p-2 rounded"
          value={activity}
          onChange={(e) => setActivity(e.target.value as Activity)}
        >
          <option value="buceo">Buceo</option>
          <option value="pesca">Pesca</option>
          <option value="navegacion">Navegación</option>
          <option value="otros">Otros</option>
        </select>
        <input
          className="border p-2 rounded"
          placeholder="Prof. mín (m)"
          value={depthMin}
          onChange={(e) => setDepthMin(e.target.value)}
        />
        <input
          className="border p-2 rounded"
          placeholder="Prof. máx (m)"
          value={depthMax}
          onChange={(e) => setDepthMax(e.target.value)}
        />
        <input
          className="border p-2 rounded"
          placeholder="Temp (°C)"
          value={tempC}
          onChange={(e) => setTempC(e.target.value)}
        />
      </div>

      <textarea
        className="border p-2 rounded w-full"
        placeholder="Notas"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        Privado (solo tú)
      </label>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600">
          GPS: {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Obteniendo…'}
        </span>
        <select
          className="ml-auto border p-1 rounded"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'direct' | 'api')}
        >
          <option value="direct">Insertar directo</option>
          <option value="api">Usar endpoint /api/observations</option>
        </select>
      </div>

      <button className="px-4 py-2 rounded bg-green-600 text-white">Guardar</button>

      {!!status && <p className="text-sm text-green-700">{status}</p>}
    </form>
  );
}