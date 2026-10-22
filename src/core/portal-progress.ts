import type { MealPlanMeal } from '@/types/nutrition';

/**
 * Avance del paciente en el portal, tal como lo guarda la base de datos.
 * Las comidas y los ítems se identifican por su posición en el plan, porque al volver a
 * guardar una versión sus ids se recrean.
 */
export interface PortalProgress {
  /** Posiciones (desde 0) de las comidas completadas hoy. */
  completedMeals: number[];
  /** Alimento elegido por el paciente para un ítem, solo donde difiere del plan. */
  foodChoices: { meal: number; item: number; foodId: string }[];
}

export const EMPTY_PROGRESS: PortalProgress = { completedMeals: [], foodChoices: [] };

/** Día calendario (AAAA-MM-DD) en Paraguay: el "hoy" del paciente, sin depender del servidor. */
export function todayInParaguay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(now);
}

/** Interpreta la respuesta de `get_portal_progress` con tolerancia: lo inesperado se descarta. */
export function parseProgress(data: unknown): PortalProgress {
  if (typeof data !== 'object' || data === null) return EMPTY_PROGRESS;
  const d = data as { completed_meals?: unknown; food_choices?: unknown };

  const completedMeals = Array.isArray(d.completed_meals)
    ? d.completed_meals.filter((n): n is number => Number.isInteger(n) && n >= 0)
    : [];

  const foodChoices: PortalProgress['foodChoices'] = [];
  if (Array.isArray(d.food_choices)) {
    for (const row of d.food_choices) {
      if (typeof row !== 'object' || row === null) continue;
      const { meal, item, food_id } = row as { meal?: unknown; item?: unknown; food_id?: unknown };
      if (Number.isInteger(meal) && Number.isInteger(item) && typeof food_id === 'string' && food_id) {
        foodChoices.push({ meal: meal as number, item: item as number, foodId: food_id });
      }
    }
  }
  return { completedMeals, foodChoices };
}

/** Aplica el avance sobre las comidas del plan; las posiciones que ya no existen se ignoran. */
export function applyProgress(meals: MealPlanMeal[], progress: PortalProgress): MealPlanMeal[] {
  const done = new Set(progress.completedMeals);
  return meals.map((meal, mealIdx) => ({
    ...meal,
    isCompleted: done.has(mealIdx),
    items: meal.items.map((item, itemIdx) => {
      const choice = progress.foodChoices.find((c) => c.meal === mealIdx && c.item === itemIdx);
      return choice ? { ...item, selectedFoodId: choice.foodId } : item;
    }),
  }));
}
