import { describe, it, expect } from 'vitest';
import type { MealPlanMeal } from '@/types/nutrition';
import { applyProgress, EMPTY_PROGRESS, parseProgress, todayInParaguay } from '../portal-progress';

const meals = (): MealPlanMeal[] =>
  [
    { id: 'm1', name: 'Desayuno', time: '07:30', items: [{ id: 'i1', groupId: 'cereales', exchangeCount: 1, selectedFoodId: 'avena' }] },
    { id: 'm2', name: 'Almuerzo', time: '12:30', items: [{ id: 'i2', groupId: 'frutas', exchangeCount: 1 }] },
  ] as MealPlanMeal[];

describe('portal-progress', () => {
  it('todayInParaguay usa la fecha de Asunción, no la del servidor', () => {
    // 01:30 UTC del 5 de enero = 22:30 del día 4 en Paraguay (UTC-3 en verano)
    expect(todayInParaguay(new Date('2026-01-05T01:30:00Z'))).toBe('2026-01-04');
    expect(todayInParaguay(new Date('2026-06-05T12:00:00Z'))).toBe('2026-06-05');
  });

  it('interpreta la respuesta de la base', () => {
    const parsed = parseProgress({
      completed_meals: [0, 2],
      food_choices: [{ meal: 1, item: 0, food_id: 'mamon' }],
    });
    expect(parsed).toEqual({ completedMeals: [0, 2], foodChoices: [{ meal: 1, item: 0, foodId: 'mamon' }] });
  });

  it('lo inesperado se descarta sin romper', () => {
    expect(parseProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(parseProgress('x')).toEqual(EMPTY_PROGRESS);
    expect(
      parseProgress({ completed_meals: [0, -1, 'a', 1.5], food_choices: [{ meal: 0 }, null, { meal: 0, item: 0, food_id: '' }] })
    ).toEqual({ completedMeals: [0], foodChoices: [] });
  });

  it('aplica comidas completadas y alimentos elegidos por posición', () => {
    const result = applyProgress(meals(), { completedMeals: [0], foodChoices: [{ meal: 1, item: 0, foodId: 'mamon' }] });
    expect(result[0].isCompleted).toBe(true);
    expect(result[1].isCompleted).toBe(false);
    expect(result[0].items[0].selectedFoodId).toBe('avena');
    expect(result[1].items[0].selectedFoodId).toBe('mamon');
  });

  it('ignora posiciones que ya no existen en el plan', () => {
    const result = applyProgress(meals(), { completedMeals: [9], foodChoices: [{ meal: 5, item: 0, foodId: 'x' }] });
    expect(result.every((m) => !m.isCompleted)).toBe(true);
    expect(result[0].items[0].selectedFoodId).toBe('avena');
  });
});
