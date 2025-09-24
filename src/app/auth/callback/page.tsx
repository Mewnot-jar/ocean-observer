'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

// Evita SSG/ISR: render dinámico en runtime
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const href = window.location.href;
    const params = new URLSearchParams(window.location.search);
    const to = params.get('redirect') || '/';

    supabase.auth.exchangeCodeForSession(href)
      .catch(() => {}) // puede ya venir con sesión
      .finally(() => router.replace(to));
  }, [router]);

  return <main className="p-6">Verificando sesión…</main>;
}
