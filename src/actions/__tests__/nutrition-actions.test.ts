import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const UUID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

/** Resultado que devolverá la próxima consulta; cada test lo ajusta. */
let queryResult: { data: unknown; error: { message: string } | null } = { data: [], error: null };
const calls: { table: string; ops: string[] }[] = [];
let session: { user: { id: string; email: string } } | null = null;
let configured = true;
/** Si se indica, las consultas a esa tabla devuelven un error. */
let failingTable: string | null = null;
/** Respuesta de las funciones RPC (`supabase.rpc`) y registro de sus llamadas. */
let rpcResult: { data: unknown; error: { message: string } | null } = { data: null, error: null };
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];

/** Cliente Supabase falso: cada llamada encadenable se registra y el `await` final devuelve `queryResult`. */
function fakeBuilder(table: string) {
  const record = { table, ops: [] as string[] };
  calls.push(record);
  const builder: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(table === failingTable ? { data: null, error: { message: `falló ${table}` } } : queryResult).then(resolve),
  };
  for (const op of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'not', 'order', 'limit', 'single', 'maybeSingle']) {
    builder[op] = (...args: unknown[]) => {
      record.ops.push(op === 'eq' ? `eq:${String(args[0])}` : op);
      return builder;
    };
  }
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  isSupabaseConfigured: () => configured,
  createClient: async () => ({
    auth: { getSession: async () => ({ data: { session } }) },
    from: (table: string) => fakeBuilder(table),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return rpcResult;
    },
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
  createClientAction,
  deleteClientAction,
  updateClientAction,
  savePlanAction,
  updateShareSettingsAction,
  getLatestPlanAction,
  getPortalProgressAction,
  setPortalMealAction,
  setPortalFoodAction,
} from '../nutrition-actions';

const validClient = {
  fullName: 'Juan Pérez',
  age: 30,
  gender: 'masculino',
  weightKg: 78,
  targetKcal: 2000,
  targetChoG: 250,
  targetProG: 100,
  targetLipG: 67,
};

const validPlan = {
  clientId: UUID,
  title: 'Plan base',
  versionNumber: 1,
  meals: [{ name: 'Desayuno', time: '07:30', items: [{ groupId: 'cereales', exchangeCount: 2 }] }],
};

beforeEach(() => {
  calls.length = 0;
  queryResult = { data: [], error: null };
  session = null;
  configured = true;
  failingTable = null;
  rpcResult = { data: null, error: null };
  rpcCalls.length = 0;
  delete process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCESS;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCESS;
});

describe('sin sesión y con Supabase configurado', () => {
  it('las acciones que escriben fallan en lugar de simular que guardaron', async () => {
    const results = await Promise.all([
      createClientAction(validClient),
      deleteClientAction(UUID),
      updateClientAction(UUID, validClient),
      savePlanAction(validPlan),
      updateShareSettingsAction(UUID, true, null),
    ]);

    for (const res of results) {
      expect(res.success).toBe(false);
      expect(res).toMatchObject({ error: expect.stringContaining('sesión') });
    }
    expect(calls).toHaveLength(0); // ni siquiera se consulta la base
  });

  it('la lectura del plan también falla en vez de devolver "sin plan"', async () => {
    const res = await getLatestPlanAction(UUID);
    expect(res.success).toBe(false);
  });

  it('con el acceso demo habilitado sigue funcionando en modo demostración', async () => {
    process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCESS = 'true';
    const res = await savePlanAction(validPlan);
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(0);
  });
});

describe('con sesión', () => {
  beforeEach(() => {
    session = { user: { id: USER_ID, email: 'lic@example.com' } };
  });

  it('deleteClientAction borra solo al paciente del usuario y confirma que hubo una fila', async () => {
    queryResult = { data: [{ id: UUID }], error: null };
    expect(await deleteClientAction(UUID)).toEqual({ success: true });
    expect(calls[0]).toEqual({ table: 'clients', ops: ['delete', 'eq:id', 'eq:nutritionist_id', 'select'] });
  });

  it('deleteClientAction avisa si no se borró ninguna fila (paciente ajeno o inexistente)', async () => {
    queryResult = { data: [], error: null };
    const res = await deleteClientAction(UUID);
    expect(res.success).toBe(false);
  });

  it('deleteClientAction propaga el error de la base', async () => {
    queryResult = { data: null, error: { message: 'boom' } };
    expect(await deleteClientAction(UUID)).toEqual({ success: false, error: 'boom' });
  });

  it('updateClientAction rechaza datos inválidos antes de tocar la base', async () => {
    const res = await updateClientAction(UUID, { ...validClient, age: 0 });
    expect(res.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('updateClientAction actualiza al paciente y reemplaza sus restricciones', async () => {
    queryResult = { data: [{ id: UUID }], error: null };
    const res = await updateClientAction(UUID, { ...validClient, exclusions: ['Lactosa'] });
    expect(res).toEqual({ success: true });
    expect(calls.map((c) => c.table)).toEqual(['clients', 'client_food_rules', 'client_food_rules']);
    expect(calls[1].ops).toContain('delete');
    expect(calls[2].ops).toContain('insert');
  });

  it('savePlanAction devuelve error si falla guardar los ítems de una comida', async () => {
    queryResult = { data: { id: UUID, share_token: 'x'.repeat(43) }, error: null };
    failingTable = 'plan_items';
    const res = await savePlanAction({ ...validPlan, id: UUID });
    expect(res).toEqual({ success: false, error: 'falló plan_items' });
  });

  it('savePlanAction guarda el plan completo cuando todo responde bien', async () => {
    queryResult = { data: { id: UUID, share_token: 'x'.repeat(43) }, error: null };
    const res = await savePlanAction({ ...validPlan, id: UUID });
    expect(res.success).toBe(true);
    expect(calls.some((c) => c.table === 'plan_items')).toBe(true);
  });
});

describe('avance del paciente en el portal (acceso por token, sin sesión)', () => {
  const TOKEN = 'a'.repeat(43);

  it('marcar una comida llama a la función de la base con el token y el día', async () => {
    rpcResult = { data: true, error: null };
    expect(await setPortalMealAction(TOKEN, '2026-10-22', 1, true)).toEqual({ success: true });
    expect(rpcCalls).toEqual([
      { fn: 'set_portal_meal', args: { p_token: TOKEN, p_day: '2026-10-22', p_meal_index: 1, p_completed: true } },
    ]);
  });

  it('si la base rechaza (enlace vencido, comida inexistente) devuelve error en vez de éxito', async () => {
    rpcResult = { data: false, error: null };
    const res = await setPortalMealAction(TOKEN, '2026-10-22', 1, true);
    expect(res.success).toBe(false);
    rpcResult = { data: null, error: { message: 'boom' } };
    expect((await setPortalFoodAction(TOKEN, 0, 0, 'mamon')).success).toBe(false);
  });

  it('rechaza datos mal formados sin llamar a la base', async () => {
    expect((await setPortalMealAction(TOKEN, 'ayer', 0, true)).success).toBe(false);
    expect((await setPortalMealAction(TOKEN, '2026-10-22', -1, true)).success).toBe(false);
    expect((await setPortalFoodAction(TOKEN, 0, 1.5, 'x')).success).toBe(false);
    expect(rpcCalls).toHaveLength(0);
  });

  it('un token de demostración (corto) no toca la base', async () => {
    expect(await setPortalMealAction('maria-elena-2026', '2026-10-22', 0, true)).toEqual({ success: true });
    expect(await getPortalProgressAction('maria-elena-2026', '2026-10-22')).toEqual({ completedMeals: [], foodChoices: [] });
    expect(rpcCalls).toHaveLength(0);
  });

  it('lee el avance guardado y lo interpreta', async () => {
    rpcResult = { data: { completed_meals: [0, 2], food_choices: [{ meal: 1, item: 0, food_id: 'mamon' }] }, error: null };
    expect(await getPortalProgressAction(TOKEN, '2026-10-22')).toEqual({
      completedMeals: [0, 2],
      foodChoices: [{ meal: 1, item: 0, foodId: 'mamon' }],
    });
  });
});
