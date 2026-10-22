// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MealPlan } from '@/types/nutrition';
import { usePlanAutosave } from '../usePlanAutosave';

const basePlan = (title = 'Plan'): MealPlan => ({
  id: 'p1',
  clientId: 'c1',
  title,
  createdAt: '2026-10-22',
  updatedAt: '2026-10-22',
  versionNumber: 1,
  meals: [{ id: 'm1', name: 'Desayuno', items: [{ id: 'i1', groupId: 'cereales', exchangeCount: 1 }] }],
});

const DELAY = 1000;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(save: (p: MealPlan) => Promise<boolean>) {
  return renderHook(({ plan }) => usePlanAutosave({ plan, save, delayMs: DELAY }), {
    initialProps: { plan: basePlan() },
  });
}

describe('usePlanAutosave', () => {
  it('no guarda nada si el plan no cambió', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { result } = setup(save);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY * 3);
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');
  });

  it('guarda sola tras la pausa y agrupa varias ediciones seguidas en un solo guardado', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { result, rerender } = setup(save);

    rerender({ plan: basePlan('Cambio 1') });
    expect(result.current.status).toBe('dirty');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY - 100);
    });
    rerender({ plan: basePlan('Cambio 2') }); // reinicia la espera
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY - 100);
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0].title).toBe('Cambio 2');
    expect(result.current.status).toBe('saved');
  });

  it('si falla queda en error y no reintenta en bucle; una nueva edición sí vuelve a intentar', async () => {
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const { result, rerender } = setup(save);

    rerender({ plan: basePlan('A') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY + 50);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('error');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY * 5);
    });
    expect(save).toHaveBeenCalledTimes(1); // sin bucle de reintentos

    rerender({ plan: basePlan('B') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY + 50);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('saved');
  });

  it('flush guarda al instante y un guardado que lanza error cuenta como fallo', async () => {
    const save = vi.fn().mockRejectedValue(new Error('red'));
    const { result, rerender } = setup(save);
    rerender({ plan: basePlan('X') });

    let ok = true;
    await act(async () => {
      ok = await result.current.flush();
    });
    expect(ok).toBe(false);
    expect(result.current.status).toBe('error');
  });

  it('una edición hecha durante el guardado se guarda después, sin pisarlo', async () => {
    let release: (v: boolean) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(() => new Promise<boolean>((r) => (release = r)))
      .mockResolvedValue(true);
    const { result, rerender } = setup(save);

    rerender({ plan: basePlan('Primero') });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY + 50);
    });
    expect(result.current.status).toBe('saving');

    rerender({ plan: basePlan('Segundo') }); // editó mientras se guardaba
    await act(async () => {
      release(true); // termina el primer guardado y React vuelve a renderizar
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY + 50);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].title).toBe('Segundo');
    expect(result.current.status).toBe('saved');
  });

  it('markSaved da por guardado un plan traído del servidor', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { result, rerender } = setup(save);
    const fromServer = basePlan('Del servidor');
    rerender({ plan: fromServer });
    act(() => result.current.markSaved(fromServer));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DELAY * 2);
    });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toBe('saved');
  });

  it('al desmontar con cambios pendientes los guarda (cambio de paciente)', async () => {
    const save = vi.fn().mockResolvedValue(true);
    const { rerender, unmount } = setup(save);
    rerender({ plan: basePlan('Pendiente') });
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('avisa al navegador al cerrar la pestaña solo si hay cambios sin guardar', () => {
    const save = vi.fn().mockResolvedValue(true);
    const { rerender } = setup(save);

    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);

    rerender({ plan: basePlan('Sin guardar') });
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});
