import { describe, it, expect } from 'vitest';
import { mapDbFood, mapDbFoods, type DbFoodRow } from '../catalog';

const row = (over: Partial<DbFoodRow> = {}): DbFoodRow => ({
  id: 'food-pororo',
  name: 'Pororó ya hecho',
  group_id: 'cereales-almidones',
  subgroup_id: 'cereal-cocido',
  state: 'cocido',
  brand: null,
  is_paraguayan_marked: false,
  country_origin: 'PY',
  source: null,
  notes: null,
  food_aliases: [{ alias: 'pochoclo' }, { alias: 'pipoca' }],
  food_portions: [{ grams: '35.00', household_qty: '1.50', measure_units: { name: 'Taza' } }],
  ...over,
});

describe('mapDbFood', () => {
  it('convierte una fila de la base en un Food de la app', () => {
    expect(mapDbFood(row())).toMatchObject({
      id: 'food-pororo',
      groupId: 'cereales-almidones',
      subgroupId: 'cereal-cocido',
      state: 'cocido',
      baseGrams: 35,
      householdQty: 1.5,
      householdUnit: 'taza',
      portionDescription: '1 ½ taza (35g)',
      aliases: ['pochoclo', 'pipoca'],
    });
  });

  it('acepta la unidad como objeto o como arreglo (según cómo anide Supabase)', () => {
    const asArray = mapDbFood(row({ food_portions: [{ grams: 50, household_qty: 2, measure_units: [{ name: 'Rebanada' }] }] }));
    expect(asArray?.householdUnit).toBe('rebanada');
  });

  it('sin unidad usa "unidad" y un estado desconocido pasa a no_aplica', () => {
    const food = mapDbFood(row({ state: 'raro', food_portions: [{ grams: 100, household_qty: 1, measure_units: null }] }));
    expect(food).toMatchObject({ householdUnit: 'unidad', state: 'no_aplica' });
  });

  it('descarta filas sin porción o con cifras inválidas', () => {
    expect(mapDbFood(row({ food_portions: [] }))).toBeNull();
    expect(mapDbFood(row({ food_portions: null }))).toBeNull();
    expect(mapDbFood(row({ food_portions: [{ grams: 0, household_qty: 1 }] }))).toBeNull();
  });

  it('mapDbFoods omite las filas inválidas y conserva el resto', () => {
    const foods = mapDbFoods([row(), row({ id: 'roto', food_portions: [] })]);
    expect(foods.map((f) => f.id)).toEqual(['food-pororo']);
  });
});
