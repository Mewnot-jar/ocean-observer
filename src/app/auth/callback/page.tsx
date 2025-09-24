import { Suspense } from 'react';
import CallbackClient from './CallBackClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Page() {
  return (
    <Suspense fallback={<main className="p-6">Verificando sesión…</main>}>
      <CallbackClient />
    </Suspense>
  );
}