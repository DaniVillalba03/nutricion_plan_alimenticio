'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Client, MealPlan } from '@/types/nutrition';
import { MOCK_CLIENTS } from '@/lib/mock-data';
import { isDemoAccessEnabled } from '@/lib/supabase/client';
import { getClientsAction, createClientAction, deleteClientAction, updateClientAction } from '@/actions/clients';
import { getLatestPlanAction } from '@/actions/plans';
import { redirectIfSessionExpired } from '@/lib/session';
import type { ClientInput } from './build-client';

interface CreateResult {
  ok: boolean;
  error?: string;
}

/** Un plan en caché: `null` significa "se consultó y el paciente no tiene plan guardado". */
interface CachedPlan {
  plan: MealPlan | null;
  at: number;
}

/** Pasado este tiempo, un plan en caché se vuelve a pedir en segundo plano. */
const PLAN_FRESH_MS = 30_000;

interface PatientsContextType {
  clients: Client[];
  /** `true` mientras llega la primera lista desde el servidor. */
  loading: boolean;
  selectedClientId: string | null;
  /** Paciente activo; `null` si todavía no hay pacientes. */
  activeClient: Client | null;
  selectClient: (id: string) => void;
  /** Crea el paciente: lo muestra de inmediato y lo persiste con la server action. */
  createClient: (client: Client, input: ClientInput) => Promise<CreateResult>;
  /** Guarda los cambios de un paciente: actualiza la lista solo cuando el servidor confirma. */
  saveClient: (client: Client, input: ClientInput) => Promise<CreateResult>;
  /** Elimina el paciente con sus planes (irreversible) y lo quita de la lista si el servidor confirma. */
  deleteClient: (id: string) => Promise<CreateResult>;
  updateClient: (id: string, patch: Partial<Client>) => void;
  /** Plan en caché del paciente: `undefined` si nunca se pidió, `null` si no tiene plan. */
  getCachedPlan: (clientId: string) => MealPlan | null | undefined;
  /** Pide el plan guardado al servidor si la caché no es reciente; resuelve con el plan o `null`. */
  fetchPlan: (clientId: string) => Promise<MealPlan | null>;
  /** Actualiza la caché (p. ej. tras guardar un plan). */
  cachePlan: (clientId: string, plan: MealPlan | null) => void;
}

const PatientsContext = createContext<PatientsContextType | undefined>(undefined);

interface PatientsProviderProps {
  children: React.ReactNode;
  /** Pacientes ya cargados en el servidor (evita pedirlos después de la primera pantalla). */
  initialClients?: Client[];
  /** Último plan guardado de cada paciente, por id (los que faltan se consideran sin plan). */
  initialPlans?: Record<string, MealPlan>;
}

/**
 * Fuente única de pacientes para el constructor y la gestión de pacientes.
 * Con Supabase solo se muestran los pacientes reales de la nutricionista; los de
 * demostración existen únicamente sin Supabase o con el acceso demo habilitado.
 */
export function PatientsProvider({ children, initialClients, initialPlans }: PatientsProviderProps) {
  const demo = isDemoAccessEnabled();
  const hasInitial = initialClients !== undefined;

  const [clients, setClients] = useState<Client[]>(initialClients ?? (demo ? MOCK_CLIENTS : []));
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    initialClients ? (initialClients[0]?.id ?? null) : demo ? MOCK_CLIENTS[0].id : null
  );
  const [loading, setLoading] = useState(!hasInitial);

  const [planCache] = useState(() => {
    const map = new Map<string, CachedPlan>();
    if (initialClients && initialPlans) {
      const now = Date.now();
      for (const c of initialClients) map.set(c.id, { plan: initialPlans[c.id] ?? null, at: now });
    }
    return map;
  });
  const inflight = useRef(new Map<string, Promise<MealPlan | null>>());

  // Sin datos del servidor (p. ej. falló el arranque): se piden desde el navegador
  useEffect(() => {
    if (hasInitial) return;
    let cancelled = false;
    getClientsAction()
      .then((res) => {
        if (cancelled || !res.success) return;
        setClients(res.data);
        setSelectedClientId((current) =>
          res.data.some((c) => c.id === current) ? current : (res.data[0]?.id ?? null)
        );
      })
      .catch(() => {
        // Sin conexión: se mantiene lo que ya hay
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hasInitial]);

  const getCachedPlan = useCallback((clientId: string) => planCache.get(clientId)?.plan, [planCache]);

  const cachePlan = useCallback((clientId: string, plan: MealPlan | null) => {
    planCache.set(clientId, { plan, at: Date.now() });
  }, [planCache]);

  const fetchPlan = useCallback(async (clientId: string): Promise<MealPlan | null> => {
    const cached = planCache.get(clientId);
    if (cached && Date.now() - cached.at < PLAN_FRESH_MS) return cached.plan;

    const pending = inflight.current.get(clientId);
    if (pending) return pending;

    const request = getLatestPlanAction(clientId)
      .then((res) => {
        if (!res.success) throw new Error(res.error || 'No se pudo cargar el plan');
        const plan = res.plan ?? null;
        planCache.set(clientId, { plan, at: Date.now() });
        return plan;
      })
      .finally(() => inflight.current.delete(clientId));

    inflight.current.set(clientId, request);
    return request;
  }, [planCache]);

  const createClient = useCallback(async (client: Client, input: ClientInput): Promise<CreateResult> => {
    setClients((prev) => [...prev, client]);
    setSelectedClientId(client.id);

    const rollback = () => {
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      setSelectedClientId((current) => (current === client.id ? null : current));
    };

    try {
      const res = await createClientAction(input);
      if (!res.success) {
        rollback();
        redirectIfSessionExpired(res.error);
        return { ok: false, error: res.error };
      }
      // Con Supabase la fila devuelta es de la base (snake_case): se recarga la lista oficial.
      // En modo demostración devuelve un `Client` y se conserva el paciente local.
      const isDatabaseRow = !!res.data && !('fullName' in res.data);
      if (isDatabaseRow) {
        const fresh = await getClientsAction();
        if (fresh.success) {
          setClients(fresh.data);
          // Se selecciona al paciente recién creado (con su id real de la base)
          const created = fresh.data.find((c) => c.fullName === client.fullName) ?? fresh.data[0];
          setSelectedClientId(created?.id ?? null);
          // Un paciente recién creado no tiene plan: evita una consulta innecesaria al abrirlo
          if (created) planCache.set(created.id, { plan: null, at: Date.now() });
        }
      }
      return { ok: true };
    } catch (err: unknown) {
      rollback();
      return { ok: false, error: err instanceof Error ? err.message : 'No se pudo guardar el paciente' };
    }
  }, [planCache]);

  const deleteClient = useCallback(async (id: string): Promise<CreateResult> => {
    try {
      const res = await deleteClientAction(id);
      if (!res.success) {
        redirectIfSessionExpired(res.error);
        return { ok: false, error: res.error };
      }
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'No se pudo eliminar el paciente' };
    }
    planCache.delete(id);
    setClients((prev) => prev.filter((c) => c.id !== id));
    // Si era el activo, `activeClient` cae al primero de la lista restante
    setSelectedClientId((current) => (current === id ? null : current));
    return { ok: true };
  }, [planCache]);

  const saveClient = useCallback(async (client: Client, input: ClientInput): Promise<CreateResult> => {
    try {
      const res = await updateClientAction(client.id, input);
      if (!res.success) {
        redirectIfSessionExpired(res.error);
        return { ok: false, error: res.error };
      }
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'No se pudieron guardar los cambios' };
    }
    setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, ...client, shareToken: c.shareToken } : c)));
    return { ok: true };
  }, []);

  const updateClient = useCallback((id: string, patch: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const value = useMemo<PatientsContextType>(() => {
    const activeClient = clients.find((c) => c.id === selectedClientId) ?? clients[0] ?? null;
    return {
      clients,
      loading,
      selectedClientId: activeClient?.id ?? null,
      activeClient,
      selectClient: setSelectedClientId,
      createClient,
      saveClient,
      deleteClient,
      updateClient,
      getCachedPlan,
      fetchPlan,
      cachePlan,
    };
  }, [clients, loading, selectedClientId, createClient, saveClient, deleteClient, updateClient, getCachedPlan, fetchPlan, cachePlan]);

  return <PatientsContext.Provider value={value}>{children}</PatientsContext.Provider>;
}

export function usePatients(): PatientsContextType {
  const ctx = useContext(PatientsContext);
  if (!ctx) throw new Error('usePatients debe usarse dentro de un PatientsProvider');
  return ctx;
}
