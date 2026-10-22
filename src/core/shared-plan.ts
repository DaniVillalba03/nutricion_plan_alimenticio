import { z } from 'zod';
import type { Client, MealPlan } from '@/types/nutrition';

/**
 * Respuesta de la función de Postgres `get_shared_plan(token)` (ver
 * supabase/migrations/20261022000001_secure_portal.sql). Contiene solo lo que
 * necesita el portal del paciente.
 */
const SharedPlanSchema = z.object({
  client: z.object({
    id: z.string(),
    full_name: z.string(),
    age: z.number().nullable().optional(),
    gender: z.enum(['masculino', 'femenino']).nullable().optional(),
    target_kcal: z.coerce.number(),
    target_cho_g: z.coerce.number(),
    target_pro_g: z.coerce.number(),
    target_lip_g: z.coerce.number(),
    exclusions: z.array(z.string()).default([]),
  }),
  plan: z.object({
    id: z.string(),
    title: z.string(),
    version_number: z.number(),
    updated_at: z.string().optional(),
    meals: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        time: z.string().nullable().optional(),
        items: z.array(
          z.object({
            id: z.string(),
            group_id: z.string(),
            subgroup_id: z.string().nullable().optional(),
            exchanges: z.coerce.number(),
            pinned_food_id: z.string().nullable().optional(),
          })
        ),
      })
    ),
  }),
});

/** Convierte la respuesta de la base en un `Client` y un `MealPlan`; `null` si no es válida. */
export function mapSharedPlan(raw: unknown, token: string): { client: Client; plan: MealPlan } | null {
  const parsed = SharedPlanSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { client: c, plan: p } = parsed.data;

  const kcal = c.target_kcal || 1;
  const client: Client = {
    id: c.id,
    fullName: c.full_name,
    age: c.age ?? 0,
    gender: c.gender ?? 'femenino',
    targetCalories: c.target_kcal,
    targetMacros: { carbohydrates: c.target_cho_g, proteins: c.target_pro_g, lipids: c.target_lip_g },
    macroDistributionPct: {
      carbohydrates: Math.round(((c.target_cho_g * 4) / kcal) * 100),
      proteins: Math.round(((c.target_pro_g * 4) / kcal) * 100),
      lipids: Math.round(((c.target_lip_g * 9) / kcal) * 100),
    },
    exclusions: c.exclusions,
    shareToken: token,
  };

  const plan: MealPlan = {
    id: p.id,
    clientId: c.id,
    title: p.title,
    createdAt: p.updated_at ?? '',
    updatedAt: p.updated_at ?? '',
    versionNumber: p.version_number,
    shareToken: token,
    meals: p.meals.map((m) => ({
      id: m.id,
      name: m.name,
      time: m.time ?? undefined,
      items: m.items.map((i) => ({
        id: i.id,
        groupId: i.group_id,
        subgroupId: i.subgroup_id ?? undefined,
        exchangeCount: i.exchanges,
        selectedFoodId: i.pinned_food_id ?? undefined,
      })),
    })),
  };

  return { client, plan };
}
