'use client';

import { useCallback, useState } from 'react';
import type { MealPlan, PlanTemplate, PlanVersion } from '@/types/nutrition';
import { newId } from '@/lib/utils';
import {
  addEmptyMeals,
  addItemToMeal,
  applyTemplate,
  archiveCurrentVersion,
  removeItemFromMeal,
  restoreVersionMeals,
  setItemSuggestedFood,
  updateItemCount,
} from '@/core/plan-operations';

/**
 * Estado del plan en edición. Las transformaciones viven en `core/plan-operations`
 * (puras y probadas); los cálculos nutricionales, en `core/exchange-engine`.
 */
export function usePlanEditor(initialPlan: MealPlan) {
  const [plan, setPlan] = useState<MealPlan>(initialPlan);

  const updateItem = useCallback((mealId: string, itemId: string, exchangeCount: number) => {
    setPlan((prev) => updateItemCount(prev, mealId, itemId, exchangeCount));
  }, []);

  const removeItem = useCallback((mealId: string, itemId: string) => {
    setPlan((prev) => removeItemFromMeal(prev, mealId, itemId));
  }, []);

  const addItem = useCallback((mealId: string, groupId: string, exchangeCount: number) => {
    setPlan((prev) => addItemToMeal(prev, mealId, groupId, exchangeCount));
  }, []);

  const setSuggestedFood = useCallback((mealId: string, itemId: string, foodId: string | undefined) => {
    setPlan((prev) => setItemSuggestedFood(prev, mealId, itemId, foodId));
  }, []);

  const addMeals = useCallback((defs: { name: string; time?: string }[]) => {
    setPlan((prev) => addEmptyMeals(prev, defs));
  }, []);

  /** Reemplaza el plan completo (al cargar el guardado de un paciente o empezar uno vacío). */
  const loadPlan = useCallback((next: MealPlan) => setPlan(next), []);

  const reset = useCallback(() => setPlan(initialPlan), [initialPlan]);

  const loadTemplate = useCallback((template: PlanTemplate) => {
    setPlan((prev) => applyTemplate(prev, template));
  }, []);

  /** Archiva la versión actual y avanza el número de versión. Devuelve el nuevo número. */
  const saveNewVersion = useCallback(
    (note: string): number => {
      const { plan: next, nextVersion } = archiveCurrentVersion(plan, note);
      setPlan(next);
      return nextVersion;
    },
    [plan]
  );

  const restoreVersion = useCallback((version: PlanVersion) => {
    setPlan((prev) => restoreVersionMeals(prev, version));
  }, []);

  /** Pasa el plan a otro paciente como borrador nuevo (sin id ni token del plan original). */
  const assignToClient = useCallback((clientId: string, title: string, shareToken?: string) => {
    setPlan((prev) => ({ ...prev, id: newId('plan-draft'), clientId, title, shareToken }));
  }, []);

  /** Guarda el id y el token que asignó el servidor al persistir el plan. */
  const setPersisted = useCallback((planId: string, shareToken: string, clientId: string) => {
    setPlan((prev) => ({ ...prev, id: planId, shareToken, clientId }));
  }, []);

  const updateShareSettings = useCallback((isRevoked: boolean, expiresAt: string | null) => {
    setPlan((prev) => ({ ...prev, isShareRevoked: isRevoked, shareExpiresAt: expiresAt || undefined }));
  }, []);

  return {
    plan,
    updateItem,
    removeItem,
    addItem,
    setSuggestedFood,
    addMeals,
    loadPlan,
    reset,
    loadTemplate,
    saveNewVersion,
    restoreVersion,
    assignToClient,
    setPersisted,
    updateShareSettings,
  };
}
