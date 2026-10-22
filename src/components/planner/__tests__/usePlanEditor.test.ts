// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlanEditor } from '../usePlanEditor';
import { MOCK_INITIAL_PLAN, MOCK_PLAN_TEMPLATES } from '@/lib/mock-data';

const setup = () => renderHook(() => usePlanEditor(MOCK_INITIAL_PLAN));

describe('usePlanEditor', () => {
  it('parte del plan inicial', () => {
    const { result } = setup();
    expect(result.current.plan).toBe(MOCK_INITIAL_PLAN);
  });

  it('actualiza, agrega y quita ítems', () => {
    const { result } = setup();
    const meal = MOCK_INITIAL_PLAN.meals[0];
    const item = meal.items[0];

    act(() => result.current.updateItem(meal.id, item.id, 2));
    expect(result.current.plan.meals[0].items[0].exchangeCount).toBe(2);

    act(() => result.current.addItem(meal.id, 'frutas', 1));
    expect(result.current.plan.meals[0].items).toHaveLength(meal.items.length + 1);

    act(() => result.current.removeItem(meal.id, item.id));
    expect(result.current.plan.meals[0].items.some((i) => i.id === item.id)).toBe(false);
  });

  it('reiniciar vuelve al plan inicial', () => {
    const { result } = setup();
    act(() => result.current.addMeals([{ name: 'Cena', time: '20:00' }]));
    expect(result.current.plan.meals).toHaveLength(MOCK_INITIAL_PLAN.meals.length + 1);

    act(() => result.current.reset());
    expect(result.current.plan).toBe(MOCK_INITIAL_PLAN);
  });

  it('guardar nueva versión devuelve el número y archiva la anterior', () => {
    const { result } = setup();
    const before = result.current.plan.versionNumber || 1.0;
    const archivedBefore = result.current.plan.versions?.length ?? 0;

    let next = 0;
    act(() => {
      next = result.current.saveNewVersion('Ajuste');
    });

    expect(next).toBe(Number((before + 1).toFixed(1)));
    expect(result.current.plan.versionNumber).toBe(next);
    expect(result.current.plan.versions).toHaveLength(archivedBefore + 1);
    expect(result.current.plan.versions![0].changeNote).toBe('Ajuste');
  });

  it('restaura una versión archivada', () => {
    const { result } = setup();
    act(() => {
      result.current.saveNewVersion('base');
    });
    const version = result.current.plan.versions![0];
    act(() => result.current.addMeals([{ name: 'Cena' }]));

    act(() => result.current.restoreVersion(version));

    expect(result.current.plan.meals).toEqual(version.meals);
    expect(result.current.plan.notes).toContain('Restaurado de Versión');
  });

  it('loadPlan reemplaza el plan completo', () => {
    const { result } = setup();
    const other = { ...MOCK_INITIAL_PLAN, id: 'otro', title: 'Plan guardado', meals: [] };

    act(() => result.current.loadPlan(other));

    expect(result.current.plan).toBe(other);
  });

  it('carga una plantilla, reasigna al paciente y actualiza el acceso compartido', () => {
    const { result } = setup();

    act(() => result.current.loadTemplate(MOCK_PLAN_TEMPLATES[0]));
    expect(result.current.plan.title).toContain(MOCK_PLAN_TEMPLATES[0].name);

    act(() => result.current.assignToClient('c-2', 'Plan copia', 'tok-2'));
    expect(result.current.plan).toMatchObject({ clientId: 'c-2', title: 'Plan copia', shareToken: 'tok-2' });

    act(() => result.current.updateShareSettings(true, '2027-01-01'));
    expect(result.current.plan).toMatchObject({ isShareRevoked: true, shareExpiresAt: '2027-01-01' });

    act(() => result.current.updateShareSettings(false, null));
    expect(result.current.plan.shareExpiresAt).toBeUndefined();
  });
});
