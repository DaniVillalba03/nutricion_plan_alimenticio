import { z } from 'zod';
import type { MealPlan, MealPlanMeal, PlanVersion } from '@/types/nutrition';

/**
 * Plan guardado en Supabase (meal_plans -> plan_versions -> plan_meals -> plan_items),
 * tal como lo devuelve una consulta anidada de PostgREST.
 */
const ItemSchema = z.object({
  id: z.string(),
  group_id: z.string(),
  subgroup_id: z.string().nullable().optional(),
  exchanges: z.coerce.number(),
  pinned_food_id: z.string().nullable().optional(),
  order_index: z.number().nullable().optional(),
});

const MealSchema = z.object({
  id: z.string(),
  name: z.string(),
  time: z.string().nullable().optional(),
  order_index: z.number().nullable().optional(),
  plan_items: z.array(ItemSchema).default([]),
});

const VersionSchema = z.object({
  id: z.string(),
  version_number: z.number(),
  is_active: z.boolean().nullable().optional(),
  share_token: z.string().nullable().optional(),
  share_expires_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  change_note: z.string().nullable().optional(),
  plan_meals: z.array(MealSchema).default([]),
});

const StoredPlanSchema = z.object({
  id: z.string(),
  client_id: z.string(),
  title: z.string(),
  notes: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  plan_versions: z.array(VersionSchema).default([]),
});

const byOrder = (a: { order_index?: number | null }, b: { order_index?: number | null }) =>
  (a.order_index ?? 0) - (b.order_index ?? 0);

function mapMeals(meals: z.infer<typeof MealSchema>[]): MealPlanMeal[] {
  return [...meals].sort(byOrder).map((m) => ({
    id: m.id,
    name: m.name,
    time: m.time ? m.time.slice(0, 5) : undefined,
    items: [...m.plan_items].sort(byOrder).map((i) => ({
      id: i.id,
      groupId: i.group_id,
      subgroupId: i.subgroup_id ?? undefined,
      exchangeCount: i.exchanges,
      selectedFoodId: i.pinned_food_id ?? undefined,
    })),
  }));
}

/**
 * Arma el `MealPlan` editable: la versión más alta es la vigente y las demás
 * pasan al historial. `null` si la fila no tiene la forma esperada.
 */
export function mapStoredPlan(raw: unknown): MealPlan | null {
  const parsed = StoredPlanSchema.safeParse(raw);
  if (!parsed.success) return null;
  const p = parsed.data;

  const versions = [...p.plan_versions].sort((a, b) => b.version_number - a.version_number);
  const current = versions[0];
  const archived: PlanVersion[] = versions.slice(1).map((v) => ({
    id: v.id,
    planId: p.id,
    versionNumber: v.version_number,
    createdAt: v.created_at ?? '',
    changeNote: v.change_note ?? undefined,
    isActive: false,
    meals: mapMeals(v.plan_meals),
  }));

  return {
    id: p.id,
    clientId: p.client_id,
    title: p.title,
    notes: p.notes ?? undefined,
    createdAt: (p.created_at ?? '').split('T')[0],
    updatedAt: (p.updated_at ?? '').split('T')[0],
    meals: current ? mapMeals(current.plan_meals) : [],
    versionNumber: current?.version_number ?? 1,
    versionNote: current?.change_note ?? undefined,
    versions: archived,
    shareToken: current?.share_token ?? undefined,
    isShareRevoked: current ? current.is_active === false : false,
    shareExpiresAt: current?.share_expires_at ?? undefined,
  };
}

/** Plan vacío para un paciente nuevo o sin plan guardado. */
export function emptyPlanFor(clientId: string, clientName: string, id: string): MealPlan {
  const today = new Date().toISOString().split('T')[0];
  return {
    id,
    clientId,
    title: `Plan de ${clientName}`,
    createdAt: today,
    updatedAt: today,
    meals: [],
    versionNumber: 1,
    versions: [],
  };
}
