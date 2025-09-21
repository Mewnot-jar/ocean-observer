'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

// Tipos básicos
type Activity = 'buceo' | 'pesca' | 'navegacion' | 'otros';

type MyObservation = {
  id: string;
  observed_at: string;
  activity: Activity;
  depth_min_m: number | null;
  depth_max_m: number | null;
  is_private: boolean;
  species: { common_name: string | null } | null;
};

export default function MyObservationsPage() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<MyObservation[]>([]);
  const [status, setStatus] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function ensureLogged() {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;

    const email = prompt('Ingresa tu correo para enviarte un Magic Link:') || '';
    if (!email) return null;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
    });
    if (error) {
      alert('No se pudo enviar el link');
      return null;
    }
    alert('Revisa tu correo y vuelve con la sesión iniciada.');
    return null;
  }

  async function load() {
    setLoading(true);

    const session = await ensureLogged();
    if (!session) {
      setLoading(false);
      return;
    }

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('observations')
      .select(
        'id, observed_at, activity, depth_min_m, depth_max_m, is_private, species:species(common_name)'
      )
      .eq('user_id', userId)
      .order('observed_at', { ascending: false });

    if (error || !data) {
      console.error(error);
      setStatus('Error cargando observaciones.');
    } else {
      setList(data as unknown as MyObservation[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function del(id: string) {
    const ok = confirm('¿Eliminar esta observación? Esta acción no se puede deshacer.');
    if (!ok) return;

    setDeletingId(id);
    setStatus('Eliminando…');

    try {
      // 1) Traer rutas de fotos asociadas
      const { data: media, error: mediaErr } = await supabase
        .from('observation_media')
        .select('storage_path')
        .eq('observation_id', id);

      if (mediaErr) console.warn('No se pudieron listar fotos:', mediaErr.message);

      // 2) Borrar archivos del bucket (si los hay)
      const paths = (media ?? []).map((m) => m.storage_path as string);
      if (paths.length > 0) {
        const { error: rmErr } = await supabase.storage.from('observations').remove(paths);
        if (rmErr) console.warn('No se pudieron borrar archivos de Storage:', rmErr.message);
      }

      // 3) Borrar la observación (las filas de media se eliminan por CASCADE)
      const { error: delErr } = await supabase.from('observations').delete().eq('id', id);
      if (delErr) throw delErr;

      // 4) Actualizar UI
      setList((prev) => prev.filter((x) => x.id !== id));
      setStatus('Observación eliminada.');
    } catch (e) {
      console.error(e);
      setStatus('No se pudo eliminar.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis observaciones</h1>
        <a href="/add" className="text-sm text-blue-600 hover:underline">
          + Nueva
        </a>
      </div>

      {loading ? (
        <p>Cargando…</p>
      ) : (
        <>
          {status && <p className="mb-3 text-sm text-gray-600">{status}</p>}

          {list.length === 0 ? (
            <p>No tienes observaciones aún.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2">Fecha</th>
                    <th className="text-left p-2">Especie</th>
                    <th className="text-left p-2">Actividad</th>
                    <th className="text-left p-2">Profundidad (m)</th>
                    <th className="text-left p-2">Privada</th>
                    <th className="text-left p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="p-2">{new Date(o.observed_at).toLocaleString()}</td>
                      <td className="p-2">{o.species?.common_name ?? '-'}</td>
                      <td className="p-2 capitalize">{o.activity}</td>
                      <td className="p-2">
                        {o.depth_min_m ?? '-'}–{o.depth_max_m ?? '-'}
                      </td>
                      <td className="p-2">{o.is_private ? 'Sí' : 'No'}</td>
                      <td className="p-2 text-right">
                        <button
                          onClick={() => del(o.id)}
                          disabled={deletingId === o.id}
                          className={`px-3 py-1 rounded text-white ${
                            deletingId === o.id ? 'bg-red-300' : 'bg-red-600 hover:bg-red-700'
                          }`}
                        >
                          {deletingId === o.id ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
