import type { Food, FoodState } from '@/types/nutrition';
import { formatFriendlyFraction } from './exchange-engine';

/** Fila de `foods` tal como la devuelve Supabase con sus porciones y sinónimos anidados. */
export interface DbFoodRow {
  id: string;
  name: string;
  group_id: string;
  subgroup_id: string | null;
  state: string;
  brand: string | null;
  is_paraguayan_marked: boolean | null;
  country_origin: string | null;
  source: string | null;
  notes: string | null;
  food_aliases?: { alias: string }[] | null;
  food_portions?: {
    grams: number | string;
    household_qty: number | string;
    measure_units?: { name: string } | { name: string }[] | null;
  }[] | null;
}

/** Select de Supabase que produce `DbFoodRow`. */
export const FOOD_SELECT =
  'id, name, group_id, subgroup_id, state, brand, is_paraguayan_marked, country_origin, source, notes, ' +
  'food_aliases(alias), food_portions(grams, household_qty, measure_units(name))';

const STATES: FoodState[] = ['crudo', 'cocido', 'no_aplica'];

/** Convierte una fila de la base en un `Food` de la app; devuelve null si está incompleta. */
export function mapDbFood(row: DbFoodRow): Food | null {
  const portion = row.food_portions?.[0];
  if (!portion) return null;

  const grams = Number(portion.grams);
  const householdQty = Number(portion.household_qty);
  if (!(grams > 0) || !(householdQty > 0)) return null;

  const unitRel = portion.measure_units;
  const unitName = (Array.isArray(unitRel) ? unitRel[0]?.name : unitRel?.name) ?? 'unidad';
  const householdUnit = unitName.toLowerCase();
  const state = (STATES as string[]).includes(row.state) ? (row.state as FoodState) : 'no_aplica';

  return {
    id: row.id,
    name: row.name,
    aliases: (row.food_aliases ?? []).map((a) => a.alias),
    groupId: row.group_id,
    subgroupId: row.subgroup_id ?? undefined,
    state,
    baseGrams: grams,
    householdQty,
    householdUnit,
    portionDescription: `${formatFriendlyFraction(householdQty)} ${householdUnit} (${grams}g)`,
    isParaguayanMarked: row.is_paraguayan_marked ?? false,
    brand: row.brand ?? undefined,
    countryOrigin: row.country_origin ?? undefined,
    source: row.source ?? undefined,
    notes: row.notes ?? undefined,
  };
}

/** Convierte las filas válidas de la base; las incompletas se omiten. */
export function mapDbFoods(rows: DbFoodRow[]): Food[] {
  const foods: Food[] = [];
  for (const row of rows) {
    const food = mapDbFood(row);
    if (food) foods.push(food);
  }
  return foods;
}
