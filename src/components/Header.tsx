"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function Header() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  
  // Carga/escucha sesión
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) setEmail(data.session?.user?.email ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const nav = useMemo(
    () => [
      { href: "/", label: "Mapa" },
      { href: "/add", label: "Agregar" },
      { href: "/my", label: "Mis observaciones" },
    ],
    []
  );

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  async function signin() {
    const mail = prompt("Ingresa tu correo para enviarte un Magic Link:") || "";
    if (!mail) return;
    const { error } = await supabase.auth.signInWithOtp({
      email: mail,
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? window.location.href : undefined,
      },
    });
    if (error) alert("No se pudo enviar el link");
    else alert("Revisa tu correo y vuelve con la sesión iniciada.");
  }

  async function signout() {
    await supabase.auth.signOut();
    if (pathname === '/') {
      window.location.reload();  // <-- simple y seguro
    } else {
      window.location.href = '/';
    }
  }

  return (
    <header className="sticky top-0 z-50 backdrop-blur bg-white/80 border-b">
      <div className="mx-auto max-w-6xl px-4">
        <div className="h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold">
            Ocean Observer
          </Link>

          <nav className="flex items-center gap-2 sm:gap-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-2 py-1 rounded-md text-sm ${
                  isActive(item.href)
                    ? "bg-zinc-900 text-white"
                    : "text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-zinc-600 max-w-[150px] truncate">
              {email ? email : "Invitado"}
            </span>
            {email ? (
              <button
                onClick={() => signout()}
                className="text-sm px-2 py-1 rounded-md border hover:bg-zinc-50"
              >
                Salir
              </button>
            ) : (
              <a
                href="/auth"
                className="text-sm px-2 py-1 rounded-md bg-zinc-900 text-white hover:opacity-90"
              >
                Ingresar
              </a>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
