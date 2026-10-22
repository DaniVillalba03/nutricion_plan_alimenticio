import { describe, it, expect } from 'vitest';
import { mapStoredPlan, emptyPlanFor } from '../stored-plan';

const row = () => ({
  id: 'p-1',
  client_id: 'c-1',
  title: 'Plan de Juan',
  notes: null,
  created_at: '2026-10-20T10:00:00Z',
  updated_at: '2026-10-22T09:00:00Z',
  plan_versions: [
    {
      id: 'v-1',
      version_number: 1,
      is_active: false,
      share_token: null,
      created_at: '2026-10-20T10:00:00Z',
      plan_meals: [{ id: 'm-old', name: 'Desayuno', time: '07:30:00', order_index: 0, plan_items: [] }],
    },
    {
      id: 'v-2',
      version_number: 2,
      is_active: true,
      share_token: 'T'.repeat(43),
      share_expires_at: '2027-01-01T00:00:00Z',
      created_at: '2026-10-22T09:00:00Z',
      plan_meals: [
        {
          id: 'm-b',
          name: 'Almuerzo',
          time: '12:30:00',
          order_index: 1,
          plan_items: [
            { id: 'i-2', group_id: 'frutas', exchanges: '1.00', order_index: 1 },
            { id: 'i-1', group_id: 'cereales-almidones', exchanges: '1.50', pinned_food_id: 'food-x', order_index: 0 },
          ],
        },
        { id: 'm-a', name: 'Desayuno', time: '07:30:00', order_index: 0, plan_items: [] },
      ],
    },
  ],
});

describe('mapStoredPlan', () => {
  it('usa la versión más alta como vigente y el resto como historial', () => {
    const plan = mapStoredPlan(row())!;

    expect(plan).toMatchObject({ id: 'p-1', clientId: 'c-1', title: 'Plan de Juan', versionNumber: 2 });
    expect(plan.versions).toHaveLength(1);
    expect(plan.versions![0]).toMatchObject({ versionNumber: 1, isActive: false });
    expect(plan.versions![0].meals[0].name).toBe('Desayuno');
  });

  it('ordena comidas e ítems por order_index y recorta la hora a HH:MM', () => {
    const plan = mapStoredPlan(row())!;

    expect(plan.meals.map((m) => m.name)).toEqual(['Desayuno', 'Almuerzo']);
    expect(plan.meals[1].time).toBe('12:30');
    expect(plan.meals[1].items.map((i) => i.id)).toEqual(['i-1', 'i-2']);
    expect(plan.meals[1].items[0]).toMatchObject({ exchangeCount: 1.5, selectedFoodId: 'food-x' });
  });

  it('expone el token, el vencimiento y si el enlace está revocado', () => {
    const plan = mapStoredPlan(row())!;
    expect(plan.shareToken).toBe('T'.repeat(43));
    expect(plan.shareExpiresAt).toBe('2027-01-01T00:00:00Z');
    expect(plan.isShareRevoked).toBe(false);

    const revoked = row();
    revoked.plan_versions[1].is_active = false;
    expect(mapStoredPlan(revoked)!.isShareRevoked).toBe(true);
  });

  it('un plan sin versiones queda vacío en versión 1', () => {
    const plan = mapStoredPlan({ ...row(), plan_versions: [] })!;
    expect(plan.meals).toEqual([]);
    expect(plan.versionNumber).toBe(1);
  });

  it('devuelve null si la fila no tiene la forma esperada', () => {
    expect(mapStoredPlan({ id: 1 })).toBeNull();
    expect(mapStoredPlan(null)).toBeNull();
  });
});

describe('emptyPlanFor', () => {
  it('crea un plan sin comidas para el paciente', () => {
    const plan = emptyPlanFor('c-9', 'Juan Perez', 'plan-draft-1');
    expect(plan).toMatchObject({
      id: 'plan-draft-1',
      clientId: 'c-9',
      title: 'Plan de Juan Perez',
      meals: [],
      versionNumber: 1,
      versions: [],
    });
  });
});
