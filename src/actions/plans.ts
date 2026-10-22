'use server';

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { SavePlanInputSchema } from '@/core/validators';
import { Client, MealPlan } from '@/types/nutrition';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { mapStoredPlan } from '@/core/stored-plan';
import { todayInParaguay } from '@/core/portal-progress';
import { getClientsAction } from './clients';
import { getAuthenticatedUser, SESSION_EXPIRED, UUID_RE } from './shared';

/** Token de acceso del portal: 32 bytes aleatorios (43 caracteres URL-safe). */
function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

// ==============================================================================
// 2. GESTIÓN DE PLANES Y VERSIONADO
// ==============================================================================

export async function savePlanAction(rawInput: unknown) {
  const parseResult = SavePlanInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((i) => i.message).join(', '),
    };
  }

  const planInput = parseResult.data;
  const user = await getAuthenticatedUser();
  if (user.unauthenticated) return { success: false, error: SESSION_EXPIRED };
  const configured = isSupabaseConfigured();

  if (!configured || user.isDemo) {
    return {
      success: true,
      message: 'Plan guardado en modo local/demostración',
      versionNumber: planInput.versionNumber,
      shareToken: planInput.shareToken || 'maria-elena-2026',
    };
  }

  try {
    // Todo el guardado (plan, versión, comidas e ítems) ocurre en UNA transacción de la base:
    // o se guarda completo o no se guarda nada. El token lo genera SIEMPRE el servidor (se
    // ignora el del cliente) y es estable por plan: el enlace del paciente apunta a la última versión.
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('save_plan', {
      p: {
        id: planInput.id && UUID_RE.test(planInput.id) ? planInput.id : null,
        client_id: planInput.clientId,
        title: planInput.title,
        notes: planInput.notes || null,
        version_number: planInput.versionNumber,
        change_note: planInput.changeNote || null,
        share_expires_at: planInput.shareExpiresAt || null,
        is_share_revoked: planInput.isShareRevoked ?? false,
        meals: planInput.meals.map((meal) => ({
          name: meal.name,
          time: meal.time || null,
          items: (meal.items ?? []).map((item) => ({
            group_id: item.groupId,
            subgroup_id: item.subgroupId || null,
            exchanges: item.exchangeCount,
            pinned_food_id: item.selectedFoodId || null,
          })),
        })),
      },
      p_new_token: generateShareToken(),
    });

    if (error || !data) return { success: false, error: error?.message || 'Error al guardar el plan' };

    const saved = data as { plan_id: string; version_id: string; share_token: string };
    revalidatePath('/dashboard');
    return {
      success: true,
      planId: saved.plan_id,
      versionId: saved.version_id,
      shareToken: saved.share_token,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al guardar el plan';
    return { success: false, error: msg };
  }
}

/**
 * Último plan guardado de un paciente (con su historial de versiones), o `plan: undefined`
 * si todavía no tiene ninguno. Solo lee planes de la nutricionista autenticada (RLS + filtro).
 */
export async function getLatestPlanAction(
  clientId: string
): Promise<{ success: boolean; plan?: MealPlan; error?: string }> {
  if (!UUID_RE.test(clientId)) return { success: true }; // paciente de demostración o aún sin guardar

  const user = await getAuthenticatedUser();
  if (user.unauthenticated) return { success: false, error: SESSION_EXPIRED };
  if (user.isDemo) return { success: true };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('meal_plans')
      .select(PLAN_SELECT)
      .eq('client_id', clientId)
      .eq('nutritionist_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: true };

    const plan = mapStoredPlan(data);
    return plan ? { success: true, plan } : { success: false, error: 'El plan guardado tiene un formato inesperado' };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al cargar el plan' };
  }
}

const PLAN_SELECT = '*, plan_versions(*, plan_meals(*, plan_items(*)))';

/**
 * Datos iniciales del panel en una sola pasada del servidor: pacientes y el último plan guardado
 * de cada uno. Se llama desde el layout, de modo que la primera pantalla ya llega con datos.
 */
export async function getDashboardDataAction(): Promise<{
  clients: Client[];
  plans: Record<string, MealPlan>;
} | null> {
  const clientsRes = await getClientsAction();
  if (!clientsRes.success) return null;

  const clients = clientsRes.data;
  const realIds = clients.map((c) => c.id).filter((id) => UUID_RE.test(id));
  if (realIds.length === 0) return { clients, plans: {} };

  const user = await getAuthenticatedUser();
  if (user.unauthenticated || user.isDemo) return { clients, plans: {} };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('meal_plans')
      .select(PLAN_SELECT)
      .in('client_id', realIds)
      .eq('nutritionist_id', user.id)
      .order('updated_at', { ascending: false });

    if (error || !data) return { clients, plans: {} };

    const plans: Record<string, MealPlan> = {};
    for (const row of data) {
      const plan = mapStoredPlan(row);
      // Vienen del más reciente al más antiguo: se conserva el primero de cada paciente
      if (plan && !plans[plan.clientId]) plans[plan.clientId] = plan;
    }
    return { clients, plans };
  } catch {
    return { clients, plans: {} };
  }
}

/** Cuánto completó hoy el paciente de su plan compartido, para mostrarlo a la nutricionista (RLS). */
export async function getPlanAdherenceAction(
  planId: string
): Promise<{ success: boolean; adherence?: { completed: number; total: number; lastAt: string | null } }> {
  if (!UUID_RE.test(planId)) return { success: true };
  const user = await getAuthenticatedUser();
  if (user.unauthenticated || user.isDemo) return { success: true };

  try {
    const supabase = await createClient();
    const { data: version } = await supabase
      .from('plan_versions')
      .select('id')
      .eq('plan_id', planId)
      .not('share_token', 'is', null)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!version) return { success: true };

    const [{ count: total }, { data: rows }] = await Promise.all([
      supabase.from('plan_meals').select('id', { count: 'exact', head: true }).eq('plan_version_id', version.id),
      supabase
        .from('portal_meal_progress')
        .select('completed_at')
        .eq('plan_version_id', version.id)
        .eq('day', todayInParaguay()),
    ]);

    const times = (rows ?? []).map((r: { completed_at: string }) => r.completed_at).sort();
    return {
      success: true,
      adherence: { completed: rows?.length ?? 0, total: total ?? 0, lastAt: times.length ? times[times.length - 1] : null },
    };
  } catch {
    return { success: true };
  }
}

/** Revoca o reactiva el enlace del paciente y fija su vencimiento (solo el dueño del plan, por RLS). */
export async function updateShareSettingsAction(
  planId: string,
  isRevoked: boolean,
  expiresAt: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(planId)) {
    // Plan aún no guardado en la base: no hay enlace que actualizar
    return { success: true };
  }
  const user = await getAuthenticatedUser();
  if (user.unauthenticated) return { success: false, error: SESSION_EXPIRED };
  if (user.isDemo) return { success: true };

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('plan_versions')
      .update({ is_active: !isRevoked, share_expires_at: expiresAt })
      .eq('plan_id', planId)
      .not('share_token', 'is', null);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al actualizar el enlace' };
  }
}
