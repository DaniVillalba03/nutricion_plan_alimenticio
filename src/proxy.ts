import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isConfigured = Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder')
  );

  const { pathname } = request.nextUrl;

  // Verificar si hay sesión demo en cookies
  const hasDemoSession = request.cookies.get('nutriplan_demo_session')?.value === 'true';

  if (isConfigured) {
    const supabase = createServerClient(
      supabaseUrl!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // Refrescar sesión con getUser()
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Con Supabase configurado, la cookie demo solo vale si se habilitó expresamente
    const demoAllowed = process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCESS === 'true';
    const isAuthenticated = Boolean(user || (demoAllowed && hasDemoSession));

    // Si intenta acceder al panel (/dashboard/*) y no está autenticado
    if (pathname.startsWith('/dashboard') && !isAuthenticated) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Si ya está autenticado e intenta ir a /login, redirigir al dashboard
    if (pathname === '/login' && isAuthenticated) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard';
      return NextResponse.redirect(redirectUrl);
    }
  } else {
    // Modo local / sin credenciales de Supabase
    // Si intenta ir a /dashboard y no tiene sesión demo activa, redirigir a /login
    // pero permitiendo fácil acceso mediante el botón de demostración de la Lic. Laura Molinas
    if (pathname.startsWith('/dashboard') && !hasDemoSession) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (pathname === '/login' && hasDemoSession) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/dashboard';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (icono)
     * - manifest.webmanifest (PWA)
     * - extensiones de imágenes y fuentes
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)',
  ],
};
