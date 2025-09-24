'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) return alert(error.message);
    alert('Contraseña actualizada. ¡Ahora puedes entrar!');
    router.replace('/auth');
  }

  if (!ready) return <main className="p-6">Preparando cambio de contraseña…</main>;

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Define tu nueva contraseña</h1>
      <form onSubmit={submit} className="space-y-3">
        <input value={pwd} onChange={e=>setPwd(e.target.value)}
          type="password" placeholder="Nueva contraseña" required
          className="w-full border rounded px-3 py-2" />
        <button className="w-full rounded bg-zinc-900 text-white py-2">Actualizar</button>
      </form>
    </main>
  );
}
