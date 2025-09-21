import './globals.css';
import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Ocean Observer',
  description: 'Registro y mapa de observaciones marinas',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      {/* layout de columna para empujar el footer al fondo */}
      <body className="min-h-dvh flex flex-col bg-neutral-50 text-zinc-900">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6 w-full flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
