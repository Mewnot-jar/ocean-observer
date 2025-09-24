// middleware.ts (en la raíz del repo; no lo pongas en /app)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';

const PROTECTED = ['/add', '/my'];

export async function middleware(req: NextRequest) {
  // Adelanta headers para evitar avisos de cookies en Edge
  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname, search } = req.nextUrl;
  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(`${p}/`));

  if (!session && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.search = `?redirect=${encodeURIComponent(pathname + (search || ''))}`;
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  // refrescamos la sesión en todas las rutas (pero solo redirigimos si está en PROTECTED)
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
