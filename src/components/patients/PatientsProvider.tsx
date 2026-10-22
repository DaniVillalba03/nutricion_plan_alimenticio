'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Client } from '@/types/nutrition';
import { MOCK_CLIENTS } from '@/lib/mock-data';
import { getClientsAction, createClientAction } from '@/actions/nutrition-actions';
import type { ClientInput } from './build-client';

interface CreateResult {
  ok: boolean;
  error?: string;
}

interface PatientsContextType {
  clients: Client[];
  selectedClientId: string;
  /** Paciente activo; siempre existe porque la lista nunca queda vacía. */
  activeClient: Client;
  selectClient: (id: string) => void;
  /** Crea el paciente: lo muestra de inmediato y lo persiste con la server action. */
  createClient: (client: Client, input: ClientInput) => Promise<CreateResult>;
  updateClient: (id: string, patch: Partial<Client>) => void;
}

const PatientsContext = createContext<PatientsContextType | undefined>(undefined);

/**
 * Fuente única de pacientes para el constructor y la gestión de pacientes.
 * Parte de los datos de prueba y se hidrata con `getClientsAction` (que devuelve
 * los de Supabase cuando está configurado y los de prueba en modo demostración).
 */
export function PatientsProvider({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [selectedClientId, setSelectedClientId] = useState<string>(MOCK_CLIENTS[0].id);

  useEffect(() => {
    let cancelled = false;
    getClientsAction()
      .then((res) => {
        if (!cancelled && res.success && res.data.length > 0) setClients(res.data);
      })
      .catch(() => {
        // Sin conexión: se mantienen los datos locales
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createClient = useCallback(async (client: Client, input: ClientInput): Promise<CreateResult> => {
    setClients((prev) => [...prev, client]);
    setSelectedClientId(client.id);

    try {
      const res = await createClientAction(input);
      if (!res.success) {
        setClients((prev) => prev.filter((c) => c.id !== client.id));
        return { ok: false, error: res.error };
      }
      // Con Supabase la fila devuelta es de la base (snake_case): se recarga la lista oficial.
      // En modo demostración devuelve un `Client` y se conserva el paciente local.
      const isDatabaseRow = !!res.data && !('fullName' in res.data);
      if (isDatabaseRow) {
        const fresh = await getClientsAction();
        if (fresh.success && fresh.data.length > 0) {
          setClients(fresh.data);
          setSelectedClientId((current) => (fresh.data.some((c) => c.id === current) ? current : fresh.data[0].id));
        }
      }
      return { ok: true };
    } catch (err: unknown) {
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      return { ok: false, error: err instanceof Error ? err.message : 'No se pudo guardar el paciente' };
    }
  }, []);

  const updateClient = useCallback((id: string, patch: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const value = useMemo<PatientsContextType>(() => {
    const activeClient = clients.find((c) => c.id === selectedClientId) ?? clients[0];
    return {
      clients,
      selectedClientId: activeClient.id,
      activeClient,
      selectClient: setSelectedClientId,
      createClient,
      updateClient,
    };
  }, [clients, selectedClientId, createClient, updateClient]);

  return <PatientsContext.Provider value={value}>{children}</PatientsContext.Provider>;
}

export function usePatients(): PatientsContextType {
  const ctx = useContext(PatientsContext);
  if (!ctx) throw new Error('usePatients debe usarse dentro de un PatientsProvider');
  return ctx;
}
