'use server';

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { MOCK_CLIENTS, MOCK_INITIAL_PLAN } from '@/lib/mock-data';
import { Client, MealPlan } from '@/types/nutrition';
import { mapSharedPlan } from '@/core/shared-plan';
import { EMPTY_PROGRESS, parseProgress, type PortalProgress } from '@/core/portal-progress';
import { isDemoDataAllowed } from './shared';

// ==============================================================================
// 3. PORTAL DEL PACIENTE (/p/[token])
// ==============================================================================

export async function getPatientPlanByTokenAction(token: string): Promise<{
  success: boolean;
  isRevokedOrExpired?: boolean;
  client?: Client;
  plan?: MealPlan;
  error?: string;
}> {
  // Datos de demostración: solo sin Supabase o con el acceso demo habilitado expresamente
  if (isDemoDataAllowed()) {
    const mockClient = MOCK_CLIENTS.find((c) => c.shareToken === token || c.id === token);
    if (mockClient) {
      if (mockClient.isShareRevoked) return { success: false, isRevokedOrExpired: true };
      return { success: true, client: mockClient, plan: MOCK_INITIAL_PLAN };
    }
  }

  if (!isSupabaseConfigured() || typeof token !== 'string' || token.length < 32 || token.length > 100) {
    return { success: false, isRevokedOrExpired: true };
  }

  try {
    // Función de Postgres (SECURITY DEFINER): devuelve solo el plan de este token, o null
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_shared_plan', { p_token: token });
    if (error || !data) return { success: false, isRevokedOrExpired: true };

    const shared = mapSharedPlan(data, token);
    if (!shared) return { success: false, isRevokedOrExpired: true };
    return { success: true, client: shared.client, plan: shared.plan };
  } catch {
    return { success: false, isRevokedOrExpired: true };
  }
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PORTAL_SAVE_ERROR = 'No se pudo guardar. Es posible que el enlace haya vencido.';

/** Solo hay base de datos para tokens reales: los de demostración no persisten nada. */
function isPersistablePortalToken(token: unknown): token is string {
  return isSupabaseConfigured() && typeof token === 'string' && token.length >= 32 && token.length <= 100;
}

/** Avance guardado del paciente para el día indicado (comidas completadas y alimentos elegidos). */
export async function getPortalProgressAction(token: string, day: string): Promise<PortalProgress> {
  if (!isPersistablePortalToken(token) || !DAY_RE.test(day)) return EMPTY_PROGRESS;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_portal_progress', { p_token: token, p_day: day });
    if (error || !data) return EMPTY_PROGRESS;
    return parseProgress(data);
  } catch {
    return EMPTY_PROGRESS;
  }
}

/** Marca o desmarca una comida como completada. La escribe la base, no el dispositivo. */
export async function setPortalMealAction(
  token: string,
  day: string,
  mealIndex: number,
  completed: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!DAY_RE.test(day) || !Number.isInteger(mealIndex) || mealIndex < 0 || typeof completed !== 'boolean') {
    return { success: false, error: 'Datos no válidos' };
  }
  if (!isPersistablePortalToken(token)) return { success: true }; // demostración: sin base de datos

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('set_portal_meal', {
      p_token: token,
      p_day: day,
      p_meal_index: mealIndex,
      p_completed: completed,
    });
    if (error || data !== true) return { success: false, error: PORTAL_SAVE_ERROR };
    return { success: true };
  } catch {
    return { success: false, error: PORTAL_SAVE_ERROR };
  }
}

/** Guarda el alimento que el paciente eligió para un ítem (`null` vuelve al del plan). */
export async function setPortalFoodAction(
  token: string,
  mealIndex: number,
  itemIndex: number,
  foodId: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!Number.isInteger(mealIndex) || !Number.isInteger(itemIndex) || mealIndex < 0 || itemIndex < 0) {
    return { success: false, error: 'Datos no válidos' };
  }
  if (!isPersistablePortalToken(token)) return { success: true };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('set_portal_food', {
      p_token: token,
      p_meal_index: mealIndex,
      p_item_index: itemIndex,
      p_food_id: foodId,
    });
    if (error || data !== true) return { success: false, error: PORTAL_SAVE_ERROR };
    return { success: true };
  } catch {
    return { success: false, error: PORTAL_SAVE_ERROR };
  }
}
