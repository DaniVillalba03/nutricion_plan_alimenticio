'use server';

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { MeasurementInputSchema } from '@/core/validators';
import { buildAdherenceSeries, lastDays } from '@/core/progress';
import { todayInParaguay } from '@/core/portal-progress';
import type { AdherenceDay, Measurement } from '@/types/nutrition';
import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser, SESSION_EXPIRED, UUID_RE } from './shared';

interface DbMeasurement {
  id: string;
  measured_on: string;
  weight_kg: number | string;
  body_fat_pct: number | string | null;
  waist_cm: number | string | null;
  notes: string | null;
}

function mapMeasurement(row: DbMeasurement): Measurement {
  return {
    id: row.id,
    measuredOn: row.measured_on,
    weightKg: Number(row.weight_kg),
    bodyFatPct: row.body_fat_pct == null ? undefined : Number(row.body_fat_pct),
    waistCm: row.waist_cm == null ? undefined : Number(row.waist_cm),
    notes: row.notes ?? undefined,
  };
}

/** Controles del paciente, del más antiguo al más reciente. Sin base de datos devuelve una lista vacía. */
export async function getMeasurementsAction(
  clientId: string
): Promise<{ success: boolean; measurements: Measurement[]; error?: string }> {
  const user = await getAuthenticatedUser();
  if (user.unauthenticated) return { success: false, measurements: [], error: SESSION_EXPIRED };
  if (!isSupabaseConfigured() || user.isDemo || !UUID_RE.test(clientId)) return { success: true, measurements: [] };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('client_measurements')
      .select('id, measured_on, weight_kg, body_fat_pct, waist_cm, notes')
      .eq('client_id', clientId)
      .order('measured_on', { ascending: true });
    if (error) return { success: false, measurements: [], error: error.message };
    return { success: true, measurements: (data ?? []).map((r) => mapMeasurement(r as DbMeasurement)) };
  } catch (err: unknown) {
    return { success: false, measurements: [], error: err instanceof Error ? err.message : 'Error inesperado' };
  }
}

/**
 * Registra un control (o corrige el del mismo día). La base deja el peso de la ficha igual al del
 * control más reciente.
 */
export async function addMeasurementAction(
  clientId: string,
  rawInput: unknown
): Promise<{ success: boolean; measurement?: Measurement; error?: string }> {
  const parsed = MeasurementInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const input = parsed.data;
  const measuredOn = input.measuredOn ?? todayInParaguay();
  if (measuredOn > todayInParaguay()) return { success: false, error: 'La fecha no puede ser futura' };

  const user = await getAuthenticatedUser();
  if (user.unauthenticated) return { success: false, error: SESSION_EXPIRED };

  const demo: Measurement = {
    id: `m-${crypto.randomUUID().slice(0, 8)}`,
    measuredOn,
    weightKg: input.weightKg,
    bodyFatPct: input.bodyFatPct,
    waistCm: input.waistCm,
    notes: input.notes || undefined,
  };
  if (!isSupabaseConfigured() || user.isDemo || !UUID_RE.test(clientId)) return { success: true, measurement: demo };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('add_measurement', {
      p: {
        client_id: clientId,
        measured_on: measuredOn,
        weight_kg: input.weightKg,
        body_fat_pct: input.bodyFatPct ?? null,
        waist_cm: input.waistCm ?? null,
        notes: input.notes ?? null,
      },
    });
    if (error || !data) return { success: false, error: error?.message || 'No se pudo guardar el control' };

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    return { success: true, measurement: mapMeasurement(data as DbMeasurement) };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado' };
  }
}

/** Elimina un control; la ficha vuelve a quedar con el peso del control más reciente que quede. */
export async function deleteMeasurementAction(measurementId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getAuthenticatedUser();
  if (user.unauthenticated) return { success: false, error: SESSION_EXPIRED };
  if (!isSupabaseConfigured() || user.isDemo || !UUID_RE.test(measurementId)) return { success: true };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('delete_measurement', { p_id: measurementId });
    if (error) return { success: false, error: error.message };
    if (data !== true) return { success: false, error: 'No se encontró el control' };
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado' };
  }
}

/** Comidas completadas por día en los últimos `days` días, sumando todas las versiones del plan. */
export async function getAdherenceHistoryAction(
  clientId: string,
  days = 28
): Promise<{ success: boolean; series: AdherenceDay[] }> {
  const range = lastDays(todayInParaguay(), Math.min(Math.max(Math.trunc(days) || 28, 7), 120));
  const empty = { success: true, series: range.map((day) => ({ day, completed: 0, total: 0 })) };

  const user = await getAuthenticatedUser();
  if (user.unauthenticated || user.isDemo || !isSupabaseConfigured() || !UUID_RE.test(clientId)) return empty;

  try {
    const supabase = await createClient();
    const { data: plans, error } = await supabase
      .from('meal_plans')
      .select('id, plan_versions(id, version_number, plan_meals(id))')
      .eq('client_id', clientId);
    if (error || !plans) return empty;

    const versions = plans.flatMap((p) =>
      ((p.plan_versions ?? []) as { id: string; version_number: number; plan_meals: { id: string }[] | null }[]).map((v) => ({
        id: v.id,
        versionNumber: v.version_number,
        mealCount: v.plan_meals?.length ?? 0,
      }))
    );
    if (versions.length === 0) return empty;

    const { data: rows } = await supabase
      .from('portal_meal_progress')
      .select('plan_version_id, day')
      .in('plan_version_id', versions.map((v) => v.id))
      .gte('day', range[0]);

    return { success: true, series: buildAdherenceSeries(range, versions, (rows ?? []) as { plan_version_id: string; day: string }[]) };
  } catch {
    return empty;
  }
}
