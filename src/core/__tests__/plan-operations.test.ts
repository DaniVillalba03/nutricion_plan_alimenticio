import { describe, it, expect } from 'vitest';
import {
  updateItemCount,
  removeItemFromMeal,
  addItemToMeal,
  setItemSuggestedFood,
  addDefaultMeal,
  applyTemplate,
  archiveCurrentVersion,
  restoreVersionMeals,
} from '../plan-operations';
import { calculatePlanTotals } from '../exchange-engine';
import type { MealPlan } from '@/types/nutrition';
import { MOCK_INITIAL_PLAN, MOCK_PLAN_TEMPLATES, MOCK_EXCHANGE_GROUPS, MOCK_CLIENTS } from '@/lib/mock-data';

const basePlan = (): MealPlan => structuredClone(MOCK_INITIAL_PLAN);

describe('Plan operations - inmutabilidad y edición', () => {
  it('actualiza la cantidad de un ítem sin mutar el plan original', () => {
    const plan = basePlan();
    const meal = plan.meals[0];
    const item = meal.items[0];
    const before = JSON.stringify(plan);

    const next = updateItemCount(plan, meal.id, item.id, 2.5);

    expect(next.meals[0].items[0].exchangeCount).toBe(2.5);
    expect(JSON.stringify(plan)).toBe(before);
    expect(next.meals[1]).toBe(plan.meals[1]);
  });

  it('ignora ids inexistentes', () => {
    const plan = basePlan();
    const next = updateItemCount(plan, 'no-existe', 'tampoco', 3);
    expect(next.meals.map((m) => m.items)).toEqual(plan.meals.map((m) => m.items));
  });

  it('quita un ítem solo de la comida indicada', () => {
    const plan = basePlan();
    const meal = plan.meals[0];
    const total = meal.items.length;

    const next = removeItemFromMeal(plan, meal.id, meal.items[0].id);

    expect(next.meals[0].items).toHaveLength(total - 1);
    expect(next.meals[0].items.some((i) => i.id === meal.items[0].id)).toBe(false);
    expect(next.meals[1].items).toHaveLength(plan.meals[1].items.length);
  });

  it('agrega un ítem con id único y la cantidad indicada', () => {
    const plan = basePlan();
    const meal = plan.meals[0];

    const once = addItemToMeal(plan, meal.id, 'frutas', 0.5);
    const twice = addItemToMeal(once, meal.id, 'frutas', 0.5);

    const added = twice.meals[0].items.slice(-2);
    expect(added.every((i) => i.groupId === 'frutas' && i.exchangeCount === 0.5)).toBe(true);
    expect(added[0].id).not.toBe(added[1].id);
    expect(twice.meals[0].items).toHaveLength(meal.items.length + 2);
  });

  it('fija y limpia el alimento sugerido', () => {
    const plan = basePlan();
    const meal = plan.meals[0];
    const item = meal.items[0];

    const fixed = setItemSuggestedFood(plan, meal.id, item.id, 'food-x');
    expect(fixed.meals[0].items[0].selectedFoodId).toBe('food-x');

    const cleared = setItemSuggestedFood(fixed, meal.id, item.id, undefined);
    expect(cleared.meals[0].items[0].selectedFoodId).toBeUndefined();
  });

  it('añade una comida por defecto con un ítem', () => {
    const plan = basePlan();
    const next = addDefaultMeal(plan);

    expect(next.meals).toHaveLength(plan.meals.length + 1);
    const added = next.meals[next.meals.length - 1];
    expect(added.items).toHaveLength(1);
    expect(added.items[0].groupId).toBe('frutas');
    expect(plan.meals.some((m) => m.id === added.id)).toBe(false);
  });

  it('los cambios se reflejan en los totales calculados por el motor', () => {
    const plan = basePlan();
    const client = MOCK_CLIENTS[0];
    const meal = plan.meals[0];
    const item = meal.items[0];

    const before = calculatePlanTotals(plan, MOCK_EXCHANGE_GROUPS, client).calories.current;
    const next = updateItemCount(plan, meal.id, item.id, item.exchangeCount + 1);
    const after = calculatePlanTotals(next, MOCK_EXCHANGE_GROUPS, client).calories.current;

    expect(after).toBeGreaterThan(before);
  });
});

describe('Plan operations - plantillas', () => {
  it('aplica una plantilla copiando comidas con ids nuevos', () => {
    const plan = basePlan();
    const template = MOCK_PLAN_TEMPLATES[0];

    const next = applyTemplate(plan, template);

    expect(next.title).toBe(`Plan Basado en: ${template.name}`);
    expect(next.meals).toHaveLength(template.meals.length);
    const templateIds = new Set(template.meals.flatMap((m) => [m.id, ...m.items.map((i) => i.id)]));
    for (const meal of next.meals) {
      expect(templateIds.has(meal.id)).toBe(false);
      for (const item of meal.items) expect(templateIds.has(item.id)).toBe(false);
    }
    expect(next.meals[0].items.map((i) => i.groupId)).toEqual(template.meals[0].items.map((i) => i.groupId));
  });

  it('no comparte referencias con la plantilla', () => {
    const template = structuredClone(MOCK_PLAN_TEMPLATES[0]);
    const next = applyTemplate(basePlan(), template);

    next.meals[0].name = 'Modificada';
    expect(template.meals[0].name).not.toBe('Modificada');
  });
});

describe('Plan operations - versionado', () => {
  it('archiva la versión actual y avanza el número', () => {
    const plan = { ...basePlan(), versionNumber: 1.0, versions: [] };

    const { plan: next, nextVersion } = archiveCurrentVersion(plan, '  Ajuste de CHO  ');

    expect(nextVersion).toBe(2.0);
    expect(next.versionNumber).toBe(2.0);
    expect(next.versions).toHaveLength(1);
    expect(next.versions![0]).toMatchObject({
      versionNumber: 1.0,
      changeNote: 'Ajuste de CHO',
      isActive: false,
      planId: plan.id,
    });
  });

  it('usa una nota por defecto y asume versión 1.0 si no hay número', () => {
    const plan = { ...basePlan(), versionNumber: undefined, versions: undefined };

    const { plan: next, nextVersion } = archiveCurrentVersion(plan, '');

    expect(nextVersion).toBe(2.0);
    expect(next.versions![0].changeNote).toBe('Evolución clínica a Versión 2');
  });

  it('el historial más reciente va primero y la copia archivada es independiente', () => {
    const v1 = archiveCurrentVersion({ ...basePlan(), versionNumber: 1.0, versions: [] }, 'uno').plan;
    const v2 = archiveCurrentVersion(v1, 'dos').plan;

    expect(v2.versions!.map((v) => v.versionNumber)).toEqual([2.0, 1.0]);

    v2.meals[0].name = 'Cambiada después';
    expect(v2.versions![0].meals[0].name).not.toBe('Cambiada después');
  });

  it('restaura las comidas de una versión y deja una nota', () => {
    const { plan: archived } = archiveCurrentVersion({ ...basePlan(), versionNumber: 1.0 }, 'base');
    const edited = removeItemFromMeal(archived, archived.meals[0].id, archived.meals[0].items[0].id);
    const version = archived.versions![0];

    const restored = restoreVersionMeals(edited, version);

    expect(restored.meals).toEqual(version.meals);
    expect(restored.meals).not.toBe(version.meals);
    expect(restored.notes).toBe('Restaurado de Versión 1 (base)');
  });
});
