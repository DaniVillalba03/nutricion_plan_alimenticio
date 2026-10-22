import { describe, it, expect } from 'vitest';
import { mapSharedPlan } from '../shared-plan';

const TOKEN = 'a'.repeat(43);

const raw = () => ({
  client: {
    id: 'c-1',
    full_name: 'María Benítez',
    age: 34,
    gender: 'femenino',
    target_kcal: '1600.00',
    target_cho_g: '200.00',
    target_pro_g: '80.00',
    target_lip_g: '53.00',
    exclusions: ['Lactosa'],
  },
  plan: {
    id: 'p-1',
    title: 'Plan 1600',
    version_number: 2,
    updated_at: '2026-10-22T10:00:00Z',
    meals: [
      {
        id: 'm-1',
        name: 'Desayuno',
        time: '07:30',
        items: [
          { id: 'i-1', group_id: 'frutas', subgroup_id: null, exchanges: '1.50', pinned_food_id: 'food-mamon' },
          { id: 'i-2', group_id: 'cereales-almidones', exchanges: 1, pinned_food_id: null },
        ],
      },
      { id: 'm-2', name: 'Cena', time: null, items: [] },
    ],
  },
});

describe('mapSharedPlan', () => {
  it('convierte la respuesta de la base en Client y MealPlan', () => {
    const result = mapSharedPlan(raw(), TOKEN);
    expect(result).not.toBeNull();
    const { client, plan } = result!;

    expect(client).toMatchObject({
      id: 'c-1',
      fullName: 'María Benítez',
      targetCalories: 1600,
      targetMacros: { carbohydrates: 200, proteins: 80, lipids: 53 },
      exclusions: ['Lactosa'],
      shareToken: TOKEN,
    });
    expect(client.macroDistributionPct).toEqual({ carbohydrates: 50, proteins: 20, lipids: 30 });

    expect(plan).toMatchObject({ id: 'p-1', clientId: 'c-1', title: 'Plan 1600', versionNumber: 2, shareToken: TOKEN });
    expect(plan.meals).toHaveLength(2);
    expect(plan.meals[0].items[0]).toEqual({
      id: 'i-1',
      groupId: 'frutas',
      subgroupId: undefined,
      exchangeCount: 1.5,
      selectedFoodId: 'food-mamon',
    });
    expect(plan.meals[0].items[1].selectedFoodId).toBeUndefined();
    expect(plan.meals[1].time).toBeUndefined();
  });

  it('no expone datos de contacto ni clínicos que la función no devuelve', () => {
    const { client } = mapSharedPlan(raw(), TOKEN)!;
    expect(client.email).toBeUndefined();
    expect(client.phone).toBeUndefined();
    expect(client.notes).toBeUndefined();
  });

  it('devuelve null si no hay plan (token inexistente, vencido o revocado)', () => {
    expect(mapSharedPlan(null, TOKEN)).toBeNull();
  });

  it('devuelve null ante una respuesta con forma inesperada', () => {
    expect(mapSharedPlan({ client: {}, plan: {} }, TOKEN)).toBeNull();
    expect(mapSharedPlan('texto', TOKEN)).toBeNull();
  });

  it('tolera una meta calórica en cero sin dividir por cero', () => {
    const data = raw();
    data.client.target_kcal = '0';
    const { client } = mapSharedPlan(data, TOKEN)!;
    expect(Number.isFinite(client.macroDistributionPct.carbohydrates)).toBe(true);
  });
});
