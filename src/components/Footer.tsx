// server component (sin "use client")
export default function Footer() {
  const raw = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.1'; // fallback
  const version = raw.replace(/^v/i, ''); // normaliza si viene con 'v'
  const year = new Date().getFullYear();

  return (
    <footer className="border-t bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-4 text-sm text-zinc-600 flex items-center justify-between">
        <span>© {year} Ocean Observer</span>
        <span>v{version}</span>
      </div>
    </footer>
  );
}
