// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Client, MealPlan } from '@/types/nutrition';
import { MOCK_CLIENTS } from '@/lib/mock-data';

const getClientsAction = vi.fn();
const createClientAction = vi.fn();
const getLatestPlanAction = vi.fn();

vi.mock('@/actions/nutrition-actions', () => ({
  getClientsAction: (...args: unknown[]) => getClientsAction(...args),
  createClientAction: (...args: unknown[]) => createClientAction(...args),
  getLatestPlanAction: (...args: unknown[]) => getLatestPlanAction(...args),
}));

import { PatientsProvider, usePatients } from '../PatientsProvider';
import { NewPatientModal } from '../NewPatientModal';
import { buildClientFromInput } from '../build-client';
import { ClientInputSchema } from '@/core/validators';

const split = { carbohydrates: 50, proteins: 20, lipids: 30 };
const newClient = (): { client: Client; input: ReturnType<typeof ClientInputSchema.parse> } => {
  const input = ClientInputSchema.parse({
    fullName: 'Juan Pérez',
    age: 30,
    gender: 'masculino',
    weightKg: 78,
    targetKcal: 2000,
    targetChoG: 250,
    targetProG: 100,
    targetLipG: 67,
  });
  return { client: buildClientFromInput(input, split), input };
};

const wrapper = ({ children }: { children: React.ReactNode }) => <PatientsProvider>{children}</PatientsProvider>;

beforeEach(() => {
  getClientsAction.mockReset().mockResolvedValue({ success: true, data: MOCK_CLIENTS });
  createClientAction.mockReset();
  getLatestPlanAction.mockReset().mockResolvedValue({ success: true });
});

describe('PatientsProvider', () => {
  it('se hidrata con los pacientes que devuelve la server action', async () => {
    const remote = [{ ...MOCK_CLIENTS[0], id: 'remote-1', fullName: 'Paciente Remoto' }];
    getClientsAction.mockResolvedValue({ success: true, data: remote });

    const { result } = renderHook(() => usePatients(), { wrapper });
    await waitFor(() => expect(result.current.clients).toEqual(remote));
  });

  it('conserva los datos locales si la carga falla', async () => {
    getClientsAction.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => usePatients(), { wrapper });
    await act(async () => {});
    expect(result.current.clients).toEqual(MOCK_CLIENTS);
  });

  it('en modo demostración crea el paciente, lo selecciona y lo conserva', async () => {
    const { client, input } = newClient();
    createClientAction.mockResolvedValue({ success: true, data: client });
    const { result } = renderHook(() => usePatients(), { wrapper });
    await act(async () => {});

    let res: { ok: boolean } | undefined;
    await act(async () => {
      res = await result.current.createClient(client, input);
    });

    expect(res?.ok).toBe(true);
    expect(createClientAction).toHaveBeenCalledWith(input);
    expect(result.current.clients.map((c) => c.id)).toContain(client.id);
    expect(result.current.activeClient?.id).toBe(client.id);
    expect(getClientsAction).toHaveBeenCalledTimes(1); // solo la hidratación inicial
  });

  it('revierte el alta y devuelve el error si el servidor la rechaza', async () => {
    const { client, input } = newClient();
    createClientAction.mockResolvedValue({ success: false, error: 'Peso inválido' });
    const { result } = renderHook(() => usePatients(), { wrapper });
    await act(async () => {});

    let res: { ok: boolean; error?: string } | undefined;
    await act(async () => {
      res = await result.current.createClient(client, input);
    });

    expect(res).toEqual({ ok: false, error: 'Peso inválido' });
    expect(result.current.clients.map((c) => c.id)).not.toContain(client.id);
  });

  it('con Supabase (fila de base) recarga la lista oficial', async () => {
    const { client, input } = newClient();
    const official = [{ ...client, id: 'db-uuid-1' }];
    createClientAction.mockResolvedValue({ success: true, data: { id: 'db-uuid-1', full_name: 'Juan Pérez' } });
    const { result } = renderHook(() => usePatients(), { wrapper });
    await act(async () => {});
    getClientsAction.mockResolvedValue({ success: true, data: official });

    await act(async () => {
      await result.current.createClient(client, input);
    });

    expect(result.current.clients).toEqual(official);
    expect(result.current.activeClient?.id).toBe('db-uuid-1');
  });

  it('updateClient aplica el parche solo al paciente indicado', async () => {
    const { result } = renderHook(() => usePatients(), { wrapper });
    await act(async () => {});

    act(() => result.current.updateClient(MOCK_CLIENTS[0].id, { isShareRevoked: true }));

    expect(result.current.clients[0].isShareRevoked).toBe(true);
    expect(result.current.clients[1].isShareRevoked).toBe(MOCK_CLIENTS[1].isShareRevoked);
  });

  it('usePatients falla fuera del proveedor', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => usePatients())).toThrow(/PatientsProvider/);
    spy.mockRestore();
  });
});

describe('PatientsProvider con Supabase configurado (sin acceso demo)', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'clave-real');
    vi.stubEnv('NEXT_PUBLIC_ENABLE_DEMO_ACCESS', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('no muestra pacientes de demostración: empieza vacío y sin paciente activo', async () => {
    getClientsAction.mockResolvedValue({ success: true, data: [] });
    const { result } = renderHook(() => usePatients(), { wrapper });

    expect(result.current.clients).toEqual([]);
    expect(result.current.activeClient).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.clients).toEqual([]);
    expect(result.current.activeClient).toBeNull();
  });

  it('muestra solo los pacientes reales y selecciona el primero', async () => {
    const real = [{ ...MOCK_CLIENTS[0], id: 'real-1', fullName: 'Juan Perez' }];
    getClientsAction.mockResolvedValue({ success: true, data: real });
    const { result } = renderHook(() => usePatients(), { wrapper });

    await waitFor(() => expect(result.current.clients).toEqual(real));
    expect(result.current.activeClient?.id).toBe('real-1');
  });

  it('si la carga falla no inventa pacientes', async () => {
    getClientsAction.mockResolvedValue({ success: false, data: [] });
    const { result } = renderHook(() => usePatients(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.clients).toEqual([]);
  });
});

const plan = (clientId: string, title = 'Plan guardado'): MealPlan => ({
  id: `plan-${clientId}`,
  clientId,
  title,
  createdAt: '2026-10-20',
  updatedAt: '2026-10-22',
  meals: [],
});

describe('PatientsProvider con datos iniciales del servidor', () => {
  const two = [
    { ...MOCK_CLIENTS[0], id: 'c-1', fullName: 'Ana' },
    { ...MOCK_CLIENTS[1], id: 'c-2', fullName: 'Beto' },
  ];
  const withInitial = (plans: Record<string, MealPlan> = {}) => {
    function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <PatientsProvider initialClients={two} initialPlans={plans}>
          {children}
        </PatientsProvider>
      );
    }
    return Wrapper;
  };

  it('muestra los pacientes al instante, sin pedirlos de nuevo', () => {
    const { result } = renderHook(() => usePatients(), { wrapper: withInitial() });

    expect(result.current.clients).toEqual(two);
    expect(result.current.loading).toBe(false);
    expect(result.current.activeClient?.id).toBe('c-1');
    expect(getClientsAction).not.toHaveBeenCalled();
  });

  it('con lista vacía del servidor no cae a datos de demostración', () => {
    const empty = ({ children }: { children: React.ReactNode }) => (
      <PatientsProvider initialClients={[]} initialPlans={{}}>
        {children}
      </PatientsProvider>
    );
    const { result } = renderHook(() => usePatients(), { wrapper: empty });

    expect(result.current.clients).toEqual([]);
    expect(result.current.activeClient).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('siembra la caché: plan guardado, sin plan (null) y nunca consultado (undefined)', () => {
    const saved = plan('c-1');
    const { result } = renderHook(() => usePatients(), { wrapper: withInitial({ 'c-1': saved }) });

    expect(result.current.getCachedPlan('c-1')).toBe(saved);
    expect(result.current.getCachedPlan('c-2')).toBeNull();
    expect(result.current.getCachedPlan('otro')).toBeUndefined();
  });

  it('fetchPlan devuelve la caché reciente sin ir al servidor', async () => {
    const saved = plan('c-1');
    const { result } = renderHook(() => usePatients(), { wrapper: withInitial({ 'c-1': saved }) });

    await expect(result.current.fetchPlan('c-1')).resolves.toBe(saved);
    expect(getLatestPlanAction).not.toHaveBeenCalled();
  });

  it('fetchPlan pide al servidor lo que no está en caché y lo guarda', async () => {
    const remote = plan('nuevo');
    getLatestPlanAction.mockResolvedValue({ success: true, plan: remote });
    const { result } = renderHook(() => usePatients(), { wrapper: withInitial() });

    await expect(result.current.fetchPlan('nuevo')).resolves.toBe(remote);
    expect(result.current.getCachedPlan('nuevo')).toBe(remote);

    await result.current.fetchPlan('nuevo');
    expect(getLatestPlanAction).toHaveBeenCalledTimes(1);
  });

  it('fetchPlan comparte la misma petición si hay dos a la vez', async () => {
    let resolve!: (v: unknown) => void;
    getLatestPlanAction.mockReturnValue(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => usePatients(), { wrapper: withInitial() });

    const a = result.current.fetchPlan('x');
    const b = result.current.fetchPlan('x');
    resolve({ success: true, plan: undefined });

    await expect(Promise.all([a, b])).resolves.toEqual([null, null]);
    expect(getLatestPlanAction).toHaveBeenCalledTimes(1);
  });

  it('fetchPlan propaga el error del servidor y no lo deja en caché', async () => {
    getLatestPlanAction.mockResolvedValue({ success: false, error: 'sin conexión' });
    const { result } = renderHook(() => usePatients(), { wrapper: withInitial() });

    await expect(result.current.fetchPlan('x')).rejects.toThrow('sin conexión');
    expect(result.current.getCachedPlan('x')).toBeUndefined();
  });

  it('cachePlan actualiza la caché (p. ej. tras guardar)', () => {
    const { result } = renderHook(() => usePatients(), { wrapper: withInitial() });
    const saved = plan('c-2', 'Recién guardado');

    act(() => result.current.cachePlan('c-2', saved));

    expect(result.current.getCachedPlan('c-2')).toBe(saved);
  });

  it('un paciente recién creado queda marcado como sin plan para no consultarlo', async () => {
    const { client, input } = newClient();
    const created = { ...client, id: 'db-1' };
    createClientAction.mockResolvedValue({ success: true, data: { id: 'db-1', full_name: 'Juan Pérez' } });
    getClientsAction.mockResolvedValue({ success: true, data: [...two, created] });
    const { result } = renderHook(() => usePatients(), { wrapper: withInitial() });

    await act(async () => {
      await result.current.createClient(client, input);
    });

    expect(result.current.getCachedPlan('db-1')).toBeNull();
  });
});

describe('NewPatientModal', () => {
  it('valida los campos obligatorios y no crea el paciente', async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal open onClose={() => {}} onCreate={onCreate} />);

    await userEvent.click(screen.getByRole('button', { name: 'Crear paciente' }));

    expect(screen.getByText('El nombre debe tener al menos 3 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Ingresa una edad válida')).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('avisa si el reparto de macros no suma 100%', async () => {
    render(<NewPatientModal open onClose={() => {}} onCreate={vi.fn()} />);

    const cho = screen.getByLabelText('% CHO');
    await userEvent.clear(cho);
    await userEvent.type(cho, '60');
    await userEvent.click(screen.getByRole('button', { name: 'Crear paciente' }));

    expect(screen.getByText(/debe sumar 100%/)).toBeInTheDocument();
  });

  it('calcula los gramos desde las calorías y el reparto', async () => {
    render(<NewPatientModal open onClose={() => {}} onCreate={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Calorías (kcal)'), '2000');
    expect(screen.getByText(/250 g/)).toBeInTheDocument();
  });

  it('crea el paciente con los datos del formulario y las restricciones marcadas', async () => {
    const onCreate = vi.fn();
    render(<NewPatientModal open onClose={() => {}} onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText('Nombre completo'), 'Juan Pérez');
    await userEvent.type(screen.getByLabelText('Edad'), '30');
    await userEvent.type(screen.getByLabelText('Peso (kg)'), '78');
    await userEvent.type(screen.getByLabelText('Calorías (kcal)'), '2000');
    await userEvent.click(screen.getByRole('button', { name: 'Sin Lactosa' }));
    await userEvent.click(screen.getByRole('button', { name: 'Crear paciente' }));

    expect(onCreate).toHaveBeenCalledTimes(1);
    const [client, input] = onCreate.mock.calls[0];
    expect(client).toMatchObject({
      fullName: 'Juan Pérez',
      age: 30,
      targetCalories: 2000,
      exclusions: ['Lactosa'],
      targetMacros: { carbohydrates: 250, proteins: 100, lipids: 67 },
    });
    expect(input.targetKcal).toBe(2000);
  });
});
