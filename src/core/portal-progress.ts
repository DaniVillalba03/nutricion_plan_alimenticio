import type { MealPlanMeal } from '@/types/nutrition';

/**
 * Avance del paciente en el portal, guardado en su propio dispositivo (el portal es anónimo y
 * no escribe en la base). Las comidas completadas valen solo para el día en que se marcaron;
 * los alimentos elegidos se conservan mientras el plan no cambie.
 */
export interface PortalProgress {
  /** Día (AAAA-MM-DD, hora local) al que pertenecen las comidas completadas. */
  day: string;
  completedMealIds: string[];
  /** Alimento elegido por ítem, solo donde difiere del plan original. */
  foodByItemId: Record<string, string>;
}

export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function emptyProgress(day: string): PortalProgress {
  return { day, completedMealIds: [], foodByItemId: {} };
}

/** Lee lo guardado con tolerancia total: un valor roto o de otro formato equivale a "sin avance". */
export function parseProgress(raw: string | null, day: string): PortalProgress {
  if (!raw) return emptyProgress(day);
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return emptyProgress(day);
    const d = data as Partial<PortalProgress>;

    const foodByItemId: Record<string, string> = {};
    if (d.foodByItemId && typeof d.foodByItemId === 'object') {
      for (const [itemId, foodId] of Object.entries(d.foodByItemId)) {
        if (typeof foodId === 'string') foodByItemId[itemId] = foodId;
      }
    }

    // Las comidas completadas de otro día ya no cuentan; los alimentos elegidos sí
    const sameDay = d.day === day && Array.isArray(d.completedMealIds);
    return {
      day,
      completedMealIds: sameDay ? (d.completedMealIds as unknown[]).filter((id): id is string => typeof id === 'string') : [],
      foodByItemId,
    };
  } catch {
    return emptyProgress(day);
  }
}

/** Aplica el avance guardado sobre las comidas del plan; los ids que ya no existen se ignoran. */
export function applyProgress(meals: MealPlanMeal[], progress: PortalProgress): MealPlanMeal[] {
  const done = new Set(progress.completedMealIds);
  return meals.map((meal) => ({
    ...meal,
    isCompleted: done.has(meal.id),
    items: meal.items.map((item) =>
      progress.foodByItemId[item.id] ? { ...item, selectedFoodId: progress.foodByItemId[item.id] } : item
    ),
  }));
}

/** Resume el estado actual contra el plan original para guardarlo. */
export function toProgress(original: MealPlanMeal[], current: MealPlanMeal[], day: string): PortalProgress {
  const originalFood = new Map<string, string | undefined>();
  for (const meal of original) for (const item of meal.items) originalFood.set(item.id, item.selectedFoodId);

  const foodByItemId: Record<string, string> = {};
  for (const meal of current) {
    for (const item of meal.items) {
      if (item.selectedFoodId && item.selectedFoodId !== originalFood.get(item.id)) {
        foodByItemId[item.id] = item.selectedFoodId;
      }
    }
  }

  return { day, completedMealIds: current.filter((m) => m.isCompleted).map((m) => m.id), foodByItemId };
}
