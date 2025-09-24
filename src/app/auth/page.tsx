"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Tab = "login" | "register" | "magic" | "reset";

export default function AuthPage() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/";
  const [tab, setTab] = useState<Tab>("login");

  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    []
  );

  useEffect(() => {
    // si ya hay sesión, redirige
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(redirectTo);
    });
  }, [router, redirectTo]);

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "");
    const password = String(f.get("password") || "");
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return alert(error.message);
    router.replace(redirectTo);
  }

  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "");
    const password = String(f.get("password") || "");
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });

    if (error) {
      console.error("signUp error:", error);
      alert(error.message);
      return;
    }

    // Caso 1: confirmación por correo DESACTIVADA -> Supabase devuelve session al tiro
    if (data.session) {
      // ya estás logueado, redirige
      router.replace("/");
      return;
    }

    // Caso 2: confirmación por correo ACTIVADA -> NO hay session, se envió email
    alert(
      "Te enviamos un correo de confirmación. Abre el link para activar tu cuenta."
    );
  }

  async function magic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback` },
    });
    if (error) return alert(error.message);
    alert("Te enviamos un link de acceso. Revisa tu correo.");
  }

  async function requestReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/reset`,
    });
    if (error) return alert(error.message);
    alert("Te enviamos un link para cambiar tu contraseña.");
  }

  async function oauthGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}/auth/callback` },
    });
    if (error) alert(error.message);
  }

  return (
    <main className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Acceso</h1>

      <div className="mb-4 flex gap-2 text-sm">
        {(["login", "register", "magic", "reset"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded border ${
              tab === t ? "bg-zinc-900 text-white" : "hover:bg-zinc-50"
            }`}
          >
            {t === "login"
              ? "Iniciar sesión"
              : t === "register"
              ? "Crear cuenta"
              : t === "magic"
              ? "Magic link"
              : "Reset pass"}
          </button>
        ))}
      </div>

      {tab === "login" && (
        <form onSubmit={login} className="space-y-3">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full border rounded px-3 py-2"
          />
          <input
            name="password"
            type="password"
            placeholder="Contraseña"
            required
            className="w-full border rounded px-3 py-2"
          />
          <button className="w-full rounded bg-zinc-900 text-white py-2">
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setTab("reset")}
            className="text-sm text-blue-600"
          >
            ¿Olvidaste tu contraseña?
          </button>
          <div className="pt-2">
            <button
              type="button"
              onClick={oauthGoogle}
              className="w-full border rounded py-2 hover:bg-zinc-50"
            >
              Entrar con Google
            </button>
          </div>
        </form>
      )}

      {tab === "register" && (
        <form onSubmit={register} className="space-y-3">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full border rounded px-3 py-2"
          />
          <input
            name="password"
            type="password"
            placeholder="Contraseña (mín. 6)"
            required
            className="w-full border rounded px-3 py-2"
          />
          <button className="w-full rounded bg-zinc-900 text-white py-2">
            Crear cuenta
          </button>
          <p className="text-xs text-zinc-500">
            Recibirás un correo para confirmar.
          </p>
        </form>
      )}

      {tab === "magic" && (
        <form onSubmit={magic} className="space-y-3">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full border rounded px-3 py-2"
          />
          <button className="w-full rounded bg-zinc-900 text-white py-2">
            Enviar magic link
          </button>
        </form>
      )}

      {tab === "reset" && (
        <form onSubmit={requestReset} className="space-y-3">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="w-full border rounded px-3 py-2"
          />
          <button className="w-full rounded bg-zinc-900 text-white py-2">
            Enviar link de reset
          </button>
          <p className="text-xs text-zinc-500">
            Te redirigirá a /auth/reset para definir nueva contraseña.
          </p>
        </form>
      )}
    </main>
  );
}
