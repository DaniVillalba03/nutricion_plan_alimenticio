import type { z } from 'zod';
import type { Client } from '@/types/nutrition';
import { ClientInputSchema } from '@/core/validators';

export type ClientInput = z.infer<typeof ClientInputSchema>;

/** Calorías por gramo (Atwater 4/4/9). */
const KCAL_PER_G = { carbohydrates: 4, proteins: 4, lipids: 9 } as const;

export interface MacroSplitPct {
  carbohydrates: number;
  proteins: number;
  lipids: number;
}

/** Convierte una meta calórica y un reparto porcentual en gramos por macronutriente. */
export function macroGramsFromSplit(kcal: number, split: MacroSplitPct) {
  return {
    carbohydrates: Math.round((kcal * split.carbohydrates) / 100 / KCAL_PER_G.carbohydrates),
    proteins: Math.round((kcal * split.proteins) / 100 / KCAL_PER_G.proteins),
    lipids: Math.round((kcal * split.lipids) / 100 / KCAL_PER_G.lipids),
  };
}

/** Arma un `Client` de la app a partir de un formulario ya validado con `ClientInputSchema`. */
export function buildClientFromInput(input: ClientInput, split: MacroSplitPct): Client {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `client-${Date.now()}`;

  return {
    id,
    fullName: input.fullName.trim(),
    email: input.email || undefined,
    phone: input.phone || undefined,
    age: input.age,
    gender: input.gender,
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    activityLevel: input.activityLevel || undefined,
    targetCalories: input.targetKcal,
    targetMacros: {
      carbohydrates: input.targetChoG,
      proteins: input.targetProG,
      lipids: input.targetLipG,
    },
    macroDistributionPct: split,
    exclusions: input.exclusions,
    notes: input.notes || undefined,
    shareToken: `token-${id.slice(0, 8)}`,
    isShareRevoked: false,
  };
}
