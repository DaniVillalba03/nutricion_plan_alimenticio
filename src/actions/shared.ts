import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { SESSION_EXPIRED } from '@/lib/session';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los datos y tokens de demostración solo existen sin Supabase o con el acceso demo habilitado. */
export function isDemoDataAllowed(): boolean {
  return !isSupabaseConfigured() || process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCESS === 'true';
}

export { SESSION_EXPIRED };

/**
 * Helper para obtener el usuario autenticado actual o fallback demo.
 * Con Supabase configurado y sin sesión, el fallback demo solo existe si el acceso demo está
 * habilitado: de lo contrario devuelve `unauthenticated` y las acciones que escriben deben
 * fallar con un error, nunca simular que guardaron.
 */
export interface AuthUser {
  id: string;
  email?: string;
  isDemo: boolean;
  /** Supabase configurado, sin sesión y sin acceso demo: no se debe leer ni escribir nada. */
  unauthenticated?: boolean;
}

export async function getAuthenticatedUser(): Promise<AuthUser> {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'lic.laura.molinas@nutriplan.py',
      isDemo: true,
    };
  }

  // getSession() lee la cookie sin ir a la red (getUser() es una llamada extra a Supabase Auth
  // en cada acción). Aquí solo se usa para saber el id y el correo: la autorización real la
  // hace RLS en la base, que verifica el JWT en cada consulta; y el proxy (src/proxy.ts) ya validó la
  // sesión con getUser() en esta misma petición.
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) {
    if (!isDemoDataAllowed()) {
      return { id: '', email: undefined, isDemo: false, unauthenticated: true };
    }
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'lic.laura.molinas@nutriplan.py',
      isDemo: true,
    };
  }

  return {
    id: user.id,
    email: user.email,
    isDemo: false,
  };
}
