import { Suspense } from 'react';
import AuthClient from './AuthClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<main className="p-6">Cargando…</main>}>
      <AuthClient />
    </Suspense>
  );
}
