'use client';

import { useCallback, useState } from 'react';
import type { MealPlan, PlanTemplate, PlanVersion } from '@/types/nutrition';
import {
  addDefaultMeal,
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

  const addMeal = useCallback(() => setPlan((prev) => addDefaultMeal(prev)), []);

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

  const assignToClient = useCallback((clientId: string, title: string, shareToken: string) => {
    setPlan((prev) => ({ ...prev, clientId, title, shareToken }));
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
    addMeal,
    reset,
    loadTemplate,
    saveNewVersion,
    restoreVersion,
    assignToClient,
    updateShareSettings,
  };
}
