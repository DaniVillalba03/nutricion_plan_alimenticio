'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Client } from '@/types/nutrition';
import { MOCK_CLIENTS } from '@/lib/mock-data';
import { isDemoAccessEnabled } from '@/lib/supabase/client';
import { getClientsAction, createClientAction } from '@/actions/nutrition-actions';
import type { ClientInput } from './build-client';

interface CreateResult {
  ok: boolean;
  error?: string;
}

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
  updateClient: (id: string, patch: Partial<Client>) => void;
}

const PatientsContext = createContext<PatientsContextType | undefined>(undefined);

/**
 * Fuente única de pacientes para el constructor y la gestión de pacientes.
 * Con Supabase solo se muestran los pacientes reales de la nutricionista; los de
 * demostración existen únicamente sin Supabase o con el acceso demo habilitado.
 */
export function PatientsProvider({ children }: { children: React.ReactNode }) {
  const demo = isDemoAccessEnabled();
  const [clients, setClients] = useState<Client[]>(demo ? MOCK_CLIENTS : []);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(demo ? MOCK_CLIENTS[0].id : null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

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
        }
      }
      return { ok: true };
    } catch (err: unknown) {
      rollback();
      return { ok: false, error: err instanceof Error ? err.message : 'No se pudo guardar el paciente' };
    }
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
      updateClient,
    };
  }, [clients, loading, selectedClientId, createClient, updateClient]);

  return <PatientsContext.Provider value={value}>{children}</PatientsContext.Provider>;
}

export function usePatients(): PatientsContextType {
  const ctx = useContext(PatientsContext);
  if (!ctx) throw new Error('usePatients debe usarse dentro de un PatientsProvider');
  return ctx;
}
