'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Food } from '@/types/nutrition';
import { MOCK_FOODS } from '@/lib/mock-data';
import { createFoodAction } from '@/actions/foods';
import { redirectIfSessionExpired } from '@/lib/session';

interface CatalogContextType {
  foods: Food[];
  /** Guarda un alimento nuevo en la base y lo suma a la lista solo si el servidor confirma. */
  addFood: (food: Food) => Promise<{ ok: boolean; error?: string }>;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

/** Catálogo de alimentos del panel: llega ya cargado desde el servidor (base de datos). */
export function CatalogProvider({ children, initialFoods }: { children: React.ReactNode; initialFoods?: Food[] }) {
  const [foods, setFoods] = useState<Food[]>(initialFoods ?? MOCK_FOODS);

  const addFood = useCallback(async (food: Food) => {
    try {
      const res = await createFoodAction(food);
      if (!res.success || !res.food) {
        redirectIfSessionExpired(res.error);
        return { ok: false, error: res.error };
      }
      const saved = res.food;
      setFoods((prev) => [...prev, saved]);
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: err instanceof Error ? err.message : 'No se pudo guardar el alimento' };
    }
  }, []);

  const value = useMemo(() => ({ foods, addFood }), [foods, addFood]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogContextType {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog debe usarse dentro de un CatalogProvider');
  return ctx;
}
