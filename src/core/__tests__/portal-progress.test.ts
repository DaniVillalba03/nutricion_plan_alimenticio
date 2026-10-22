import { describe, it, expect } from 'vitest';
import type { MealPlanMeal } from '@/types/nutrition';
import { applyProgress, dayKey, emptyProgress, parseProgress, toProgress } from '../portal-progress';

const meals = (): MealPlanMeal[] => [
  { id: 'm1', name: 'Desayuno', time: '07:30', items: [{ id: 'i1', groupId: 'cereales', exchangeCount: 1, selectedFoodId: 'avena' }] },
  { id: 'm2', name: 'Almuerzo', time: '12:30', items: [{ id: 'i2', groupId: 'frutas', exchangeCount: 1 }] },
] as MealPlanMeal[];

describe('portal-progress', () => {
  it('dayKey usa la fecha local con ceros', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('guarda y recupera comidas completadas y alimentos elegidos', () => {
    const original = meals();
    const current = applyProgress(original, {
      day: '2026-10-22',
      completedMealIds: ['m1'],
      foodByItemId: { i2: 'mamon' },
    });
    expect(current[0].isCompleted).toBe(true);
    expect(current[1].items[0].selectedFoodId).toBe('mamon');

    const saved = toProgress(original, current, '2026-10-22');
    expect(saved).toEqual({ day: '2026-10-22', completedMealIds: ['m1'], foodByItemId: { i2: 'mamon' } });

    const restored = applyProgress(original, parseProgress(JSON.stringify(saved), '2026-10-22'));
    expect(restored).toEqual(current);
  });

  it('no guarda como cambio un alimento igual al del plan', () => {
    const original = meals();
    expect(toProgress(original, original, '2026-10-22').foodByItemId).toEqual({});
  });

  it('las comidas completadas caducan al día siguiente, los alimentos elegidos no', () => {
    const raw = JSON.stringify({ day: '2026-10-21', completedMealIds: ['m1'], foodByItemId: { i2: 'mamon' } });
    expect(parseProgress(raw, '2026-10-22')).toEqual({ day: '2026-10-22', completedMealIds: [], foodByItemId: { i2: 'mamon' } });
  });

  it('un valor roto equivale a sin avance', () => {
    expect(parseProgress('{no es json', '2026-10-22')).toEqual(emptyProgress('2026-10-22'));
    expect(parseProgress('42', '2026-10-22')).toEqual(emptyProgress('2026-10-22'));
    expect(parseProgress(null, '2026-10-22')).toEqual(emptyProgress('2026-10-22'));
  });

  it('ignora ids que ya no existen en el plan', () => {
    const result = applyProgress(meals(), { day: 'd', completedMealIds: ['borrada'], foodByItemId: { x: 'y' } });
    expect(result.every((m) => !m.isCompleted)).toBe(true);
  });
});
