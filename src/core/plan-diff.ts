import type { MealPlanItem, MealPlanMeal } from '@/types/nutrition';

/** Un cambio entre dos versiones de un plan, listo para mostrarse. */
export type PlanChange =
  | { kind: 'meal-added'; meal: string }
  | { kind: 'meal-removed'; meal: string }
  | { kind: 'item-added'; meal: string; groupId: string; to: number }
  | { kind: 'item-removed'; meal: string; groupId: string; from: number }
  | { kind: 'item-changed'; meal: string; groupId: string; from: number; to: number };

const norm = (s: string) => s.trim().toLowerCase();

/** Empareja los ítems de un mismo grupo por orden (dos ítems del mismo grupo en una comida son válidos). */
function itemsByGroup(items: MealPlanItem[]): Map<string, MealPlanItem[]> {
  const map = new Map<string, MealPlanItem[]>();
  for (const item of items) {
    const list = map.get(item.groupId) ?? [];
    list.push(item);
    map.set(item.groupId, list);
  }
  return map;
}

/**
 * Qué cambió de `before` a `after`. Las comidas se emparejan por nombre; dentro de una comida,
 * los ítems por grupo de intercambio. Solo cuentan los cambios de contenido (comidas, grupos y
 * cantidades): el alimento sugerido y los horarios no se comparan.
 */
export function diffMeals(before: MealPlanMeal[], after: MealPlanMeal[]): PlanChange[] {
  const changes: PlanChange[] = [];
  const unmatched = [...before];

  for (const next of after) {
    const idx = unmatched.findIndex((m) => norm(m.name) === norm(next.name));
    if (idx === -1) {
      changes.push({ kind: 'meal-added', meal: next.name });
      continue;
    }
    const [prev] = unmatched.splice(idx, 1);

    const prevGroups = itemsByGroup(prev.items);
    const nextGroups = itemsByGroup(next.items);
    const groupIds = new Set([...prevGroups.keys(), ...nextGroups.keys()]);

    for (const groupId of groupIds) {
      const a = prevGroups.get(groupId) ?? [];
      const b = nextGroups.get(groupId) ?? [];
      const common = Math.min(a.length, b.length);
      for (let i = 0; i < common; i++) {
        if (a[i].exchangeCount !== b[i].exchangeCount) {
          changes.push({ kind: 'item-changed', meal: next.name, groupId, from: a[i].exchangeCount, to: b[i].exchangeCount });
        }
      }
      for (const extra of b.slice(common)) {
        changes.push({ kind: 'item-added', meal: next.name, groupId, to: extra.exchangeCount });
      }
      for (const gone of a.slice(common)) {
        changes.push({ kind: 'item-removed', meal: next.name, groupId, from: gone.exchangeCount });
      }
    }
  }

  for (const gone of unmatched) changes.push({ kind: 'meal-removed', meal: gone.name });
  return changes;
}
