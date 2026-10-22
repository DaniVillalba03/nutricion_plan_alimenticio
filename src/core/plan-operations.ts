import type { MealPlan, MealPlanItem, MealPlanMeal, PlanTemplate, PlanVersion } from '@/types/nutrition';
import { cloneDeep, newId } from '@/lib/utils';

/**
 * Transformaciones puras e inmutables sobre un plan. Las usa `usePlanEditor`
 * y se prueban sin React.
 */

/** Aplica `fn` a una comida concreta del plan, dejando el resto intacto. */
export function mapMeal(plan: MealPlan, mealId: string, fn: (meal: MealPlanMeal) => MealPlanMeal): MealPlan {
  return { ...plan, meals: plan.meals.map((meal) => (meal.id === mealId ? fn(meal) : meal)) };
}

export function mapItem(
  plan: MealPlan,
  mealId: string,
  itemId: string,
  fn: (item: MealPlanItem) => MealPlanItem
): MealPlan {
  return mapMeal(plan, mealId, (meal) => ({
    ...meal,
    items: meal.items.map((item) => (item.id === itemId ? fn(item) : item)),
  }));
}

export function updateItemCount(plan: MealPlan, mealId: string, itemId: string, exchangeCount: number): MealPlan {
  return mapItem(plan, mealId, itemId, (item) => ({ ...item, exchangeCount }));
}

export function removeItemFromMeal(plan: MealPlan, mealId: string, itemId: string): MealPlan {
  return mapMeal(plan, mealId, (meal) => ({ ...meal, items: meal.items.filter((item) => item.id !== itemId) }));
}

export function addItemToMeal(plan: MealPlan, mealId: string, groupId: string, exchangeCount: number): MealPlan {
  const item: MealPlanItem = { id: newId('item'), groupId, exchangeCount };
  return mapMeal(plan, mealId, (meal) => ({ ...meal, items: [...meal.items, item] }));
}

export function setItemSuggestedFood(
  plan: MealPlan,
  mealId: string,
  itemId: string,
  foodId: string | undefined
): MealPlan {
  return mapItem(plan, mealId, itemId, (item) => ({ ...item, selectedFoodId: foodId }));
}

/** Tipos de comida disponibles para añadir a un plan (nombre y hora sugerida). */
export const MEAL_TYPES: { name: string; time: string }[] = [
  { name: 'Desayuno', time: '07:30' },
  { name: 'Media Mañana', time: '10:00' },
  { name: 'Almuerzo', time: '12:30' },
  { name: 'Merienda', time: '16:00' },
  { name: 'Cena', time: '20:00' },
  { name: 'Colación Nocturna', time: '22:00' },
];

/** Añade comidas vacías (sin grupos) al final del plan. */
export function addEmptyMeals(plan: MealPlan, defs: { name: string; time?: string }[]): MealPlan {
  const meals: MealPlanMeal[] = defs.map((d) => ({ id: newId('meal'), name: d.name, time: d.time, items: [] }));
  return { ...plan, meals: [...plan.meals, ...meals] };
}

/** Reemplaza las comidas del plan por una copia de la plantilla, con ids nuevos. */
export function applyTemplate(plan: MealPlan, template: PlanTemplate): MealPlan {
  const meals = template.meals.map((meal) => ({
    ...cloneDeep(meal),
    id: newId('meal'),
    items: meal.items.map((item) => ({ ...item, id: newId('item') })),
  }));
  return { ...plan, title: `Plan Basado en: ${template.name}`, meals };
}

/** Archiva la versión actual en el historial y avanza el número de versión. */
export function archiveCurrentVersion(plan: MealPlan, note: string): { plan: MealPlan; nextVersion: number } {
  const current = plan.versionNumber || 1.0;
  const nextVersion = Number((current + 1.0).toFixed(1));
  const archived: PlanVersion = {
    id: newId('version'),
    planId: plan.id,
    versionNumber: current,
    createdAt: new Date().toISOString(),
    changeNote: note.trim() || `Evolución clínica a Versión ${nextVersion}`,
    isActive: false,
    meals: cloneDeep(plan.meals),
  };
  return {
    nextVersion,
    plan: {
      ...plan,
      versionNumber: nextVersion,
      updatedAt: new Date().toISOString().split('T')[0],
      versions: [archived, ...(plan.versions || [])],
    },
  };
}

export function restoreVersionMeals(plan: MealPlan, version: PlanVersion): MealPlan {
  return {
    ...plan,
    meals: cloneDeep(version.meals),
    notes: `Restaurado de Versión ${version.versionNumber} (${version.changeNote})`,
  };
}
