import type { MealPlan } from '@/types/nutrition';

/**
 * Huella del contenido de un plan que se guarda en la base: título, notas, versión, enlace
 * (vencimiento y revocación) y las comidas con sus ítems. Ignora lo que asigna el servidor
 * (ids, token) y lo que no se persiste, de modo que dos planes con la misma huella son iguales
 * para efectos de "¿hay cambios sin guardar?".
 */
export function planSignature(plan: MealPlan): string {
  return JSON.stringify([
    plan.title,
    plan.notes ?? '',
    plan.versionNumber ?? 1,
    plan.shareExpiresAt ?? null,
    plan.isShareRevoked ?? false,
    plan.meals.map((meal) => [
      meal.name,
      meal.time ?? '',
      meal.items.map((item) => [item.groupId, item.subgroupId ?? '', item.exchangeCount, item.selectedFoodId ?? '']),
    ]),
  ]);
}
