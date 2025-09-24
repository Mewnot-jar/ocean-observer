'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function CallbackClient() {
  const router = useRouter();
  const params = useSearchParams();
  const to = params.get('redirect') || '/';

  useEffect(() => {
    supabase.auth.exchangeCodeForSession(window.location.href)
      .catch(() => {})
      .finally(() => router.replace(to));
  }, [router, to]);

  return null;
}
