import { describe, it, expect } from 'vitest';
import type { MealPlanMeal } from '@/types/nutrition';
import { diffMeals } from '../plan-diff';

const meal = (name: string, items: [string, number][]): MealPlanMeal => ({
  id: `m-${name}`,
  name,
  items: items.map(([groupId, exchangeCount], i) => ({ id: `i-${name}-${i}`, groupId, exchangeCount })),
});

describe('diffMeals', () => {
  it('sin cambios devuelve una lista vacía (aunque cambien los ids)', () => {
    const a = [meal('Desayuno', [['cereales', 1]])];
    const b = [{ ...meal('Desayuno', [['cereales', 1]]), id: 'otro' }];
    expect(diffMeals(a, b)).toEqual([]);
  });

  it('detecta cambios de cantidad, ítems nuevos y quitados', () => {
    const before = [meal('Desayuno', [['cereales', 1], ['frutas', 1]])];
    const after = [meal('Desayuno', [['cereales', 1.5], ['lacteos', 1]])];
    expect(diffMeals(before, after)).toEqual([
      { kind: 'item-changed', meal: 'Desayuno', groupId: 'cereales', from: 1, to: 1.5 },
      { kind: 'item-removed', meal: 'Desayuno', groupId: 'frutas', from: 1 },
      { kind: 'item-added', meal: 'Desayuno', groupId: 'lacteos', to: 1 },
    ]);
  });

  it('detecta comidas nuevas y quitadas, sin importar mayúsculas', () => {
    const before = [meal('Desayuno', []), meal('Merienda', [])];
    const after = [meal('desayuno', []), meal('Cena', [])];
    expect(diffMeals(before, after)).toEqual([
      { kind: 'meal-added', meal: 'Cena' },
      { kind: 'meal-removed', meal: 'Merienda' },
    ]);
  });

  it('dos ítems del mismo grupo en una comida se emparejan por orden', () => {
    const before = [meal('Almuerzo', [['carnes', 1], ['carnes', 2]])];
    const after = [meal('Almuerzo', [['carnes', 1], ['carnes', 3]])];
    expect(diffMeals(before, after)).toEqual([
      { kind: 'item-changed', meal: 'Almuerzo', groupId: 'carnes', from: 2, to: 3 },
    ]);
  });

  it('un grupo repetido de más cuenta como ítem agregado', () => {
    const before = [meal('Almuerzo', [['carnes', 1]])];
    const after = [meal('Almuerzo', [['carnes', 1], ['carnes', 1]])];
    expect(diffMeals(before, after)).toEqual([{ kind: 'item-added', meal: 'Almuerzo', groupId: 'carnes', to: 1 }]);
  });
});
