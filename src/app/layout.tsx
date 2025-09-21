import './globals.css';
import type { Metadata } from 'next';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'Ocean Observer',
  description: 'Registro y mapa de observaciones marinas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh bg-neutral-50 text-zinc-900">
        <Header />
        <div className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </div>
      </body>
    </html>
  );
}
