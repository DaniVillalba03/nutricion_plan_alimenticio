import { createBrowserClient } from '@supabase/ssr';

/**
 * Cliente de Supabase para el navegador (Client Components).
 * Utiliza cookies automáticamente para mantener sincronizada la sesión.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-nutriplan.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Comprueba si Supabase está configurado con credenciales reales
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
    key &&
    !url.includes('placeholder') &&
    !key.includes('placeholder')
  );
}

/**
 * El acceso demo (cookie `nutriplan_demo_session`) solo existe sin Supabase configurado,
 * o si se activa a propósito con NEXT_PUBLIC_ENABLE_DEMO_ACCESS=true. En producción
 * con Supabase, el panel exige una sesión real.
 */
export function isDemoAccessEnabled(): boolean {
  return !isSupabaseConfigured() || process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCESS === 'true';
}
