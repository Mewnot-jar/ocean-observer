'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const to = params.get('redirect') || '/';

  useEffect(() => {
    supabase.auth.exchangeCodeForSession(window.location.href)
      .catch(() => {/* ya puede venir con sesión; ignorar */})
      .finally(() => router.replace(to));
  }, [router, to]);

  return <main className="p-6">Verificando sesión…</main>;
}
