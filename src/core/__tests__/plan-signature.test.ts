import { describe, it, expect } from 'vitest';
import type { MealPlan } from '@/types/nutrition';
import { planSignature } from '../plan-signature';

const plan = (): MealPlan => ({
  id: 'p1',
  clientId: 'c1',
  title: 'Plan',
  createdAt: '2026-10-22',
  updatedAt: '2026-10-22',
  versionNumber: 1,
  shareToken: 'tok',
  meals: [
    {
      id: 'm1',
      name: 'Desayuno',
      time: '07:30',
      items: [{ id: 'i1', groupId: 'cereales', exchangeCount: 1, selectedFoodId: 'avena' }],
    },
  ],
});

describe('planSignature', () => {
  it('no cambia con lo que asigna el servidor (ids, token, cliente)', () => {
    const a = plan();
    const b = { ...plan(), id: 'otro', shareToken: 'otro-token', clientId: 'c2', updatedAt: 'x' };
    b.meals = [{ ...b.meals[0], id: 'm-nuevo', items: [{ ...b.meals[0].items[0], id: 'i-nuevo' }] }];
    expect(planSignature(b)).toBe(planSignature(a));
  });

  it('cambia con cualquier edición del contenido', () => {
    const base = planSignature(plan());
    const edits: ((p: MealPlan) => void)[] = [
      (p) => (p.title = 'Otro título'),
      (p) => (p.notes = 'nota'),
      (p) => (p.versionNumber = 2),
      (p) => (p.isShareRevoked = true),
      (p) => (p.shareExpiresAt = '2026-12-01'),
      (p) => (p.meals[0].name = 'Merienda'),
      (p) => (p.meals[0].time = '08:00'),
      (p) => (p.meals[0].items[0].exchangeCount = 1.5),
      (p) => (p.meals[0].items[0].selectedFoodId = 'granola'),
      (p) => p.meals[0].items.push({ id: 'i2', groupId: 'frutas', exchangeCount: 1 }),
      (p) => p.meals.push({ id: 'm2', name: 'Cena', items: [] }),
    ];
    for (const edit of edits) {
      const p = plan();
      edit(p);
      expect(planSignature(p)).not.toBe(base);
    }
  });

  it('valores ausentes y vacíos equivalen (no marca cambios falsos)', () => {
    const a = plan();
    const b = plan();
    b.notes = '';
    b.isShareRevoked = false;
    b.meals[0].items[0].subgroupId = undefined;
    expect(planSignature(b)).toBe(planSignature(a));
  });
});
