import { z } from 'zod';
import { ExchangeGroup, GroupSuggestionResult } from '@/types/nutrition';
import { validateAtwater449 } from '@/core/exchange-engine';

/**
 * Esquemas Zod para Validación de Datos Nutricionales
 */

export const FoodStateSchema = z.enum(['crudo', 'cocido', 'no_aplica']);
export const GroupCategorySchema = z.enum(['base', 'discrecional']);

export const MacroNutrientsSchema = z.object({
  calories: z.number().min(0, 'Las calorías deben ser mayores o iguales a 0'),
  carbohydrates: z.number().min(0, 'Los carbohidratos deben ser mayores o iguales a 0'),
  proteins: z.number().min(0, 'Las proteínas deben ser mayores o iguales a 0'),
  lipids: z.number().min(0, 'Los lípidos deben ser mayores o iguales a 0'),
});

export const FoodNutrients100gSchema = z.object({
  kcal100g: z.number().min(0, 'Kcal/100g debe ser mayor o igual a 0'),
  cho100g: z.number().min(0, 'CHO/100g debe ser mayor o igual a 0'),
  pro100g: z.number().min(0, 'PRO/100g debe ser mayor o igual a 0'),
  lip100g: z.number().min(0, 'LIP/100g debe ser mayor o igual a 0'),
});

export const FoodInputSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  groupId: z.string().min(1, 'El grupo de intercambio es obligatorio'),
  subgroupId: z.string().optional(),
  state: FoodStateSchema,
  baseGrams: z.number().positive('Los gramos base deben ser mayores a 0'),
  householdQty: z.number().positive('La cantidad casera debe ser mayor a 0'),
  householdUnit: z.string().min(1, 'La unidad casera es obligatoria'),
  portionDescription: z.string().min(1, 'La descripción de la porción es obligatoria'),
  aliases: z.array(z.string()).default([]),
  brand: z.string().optional(),
  isParaguayanMarked: z.boolean().default(false),
  countryOrigin: z.string().default('PY'),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const ImportRowSchema = z.object({
  nombre: z.string().min(1, 'Nombre del alimento requerido'),
  grupo: z.string().optional(),
  kcal_100g: z.coerce.number().min(0).optional(),
  cho_100g: z.coerce.number().min(0).optional(),
  pro_100g: z.coerce.number().min(0).optional(),
  lip_100g: z.coerce.number().min(0).optional(),
  gramos_base: z.coerce.number().positive().optional(),
  medida_casera: z.string().optional(),
});

export const ClientInputSchema = z.object({
  fullName: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  email: z.string().email('Correo electrónico no válido').optional().or(z.literal('')),
  phone: z.string().optional(),
  age: z.coerce.number().min(1, 'Ingresa una edad válida').max(120, 'Ingresa una edad válida'),
  gender: z.enum(['masculino', 'femenino']),
  weightKg: z.coerce.number().positive('El peso debe ser mayor a 0'),
  heightCm: z.coerce.number().positive().optional(),
  activityLevel: z.string().optional(),
  targetKcal: z.coerce.number().positive('Calorías objetivo deben ser mayores a 0'),
  targetChoG: z.coerce.number().min(0),
  targetProG: z.coerce.number().min(0),
  targetLipG: z.coerce.number().min(0),
  notes: z.string().optional(),
  consentAccepted: z.boolean().default(true),
  exclusions: z.array(z.string()).default([]),
});

export const SavePlanInputSchema = z.object({
  id: z.string().optional(),
  clientId: z.string().min(1, 'El cliente es obligatorio'),
  title: z.string().min(2, 'El título del plan es obligatorio'),
  notes: z.string().optional(),
  versionNumber: z.number().default(1.0),
  changeNote: z.string().optional(),
  meals: z.array(z.any()),
  shareToken: z.string().optional(),
  shareExpiresAt: z.string().optional().nullable(),
  isShareRevoked: z.boolean().optional(),
});

/**
 * Motor Sugeridor de Grupo de Intercambio a partir de Nutrientes por 100g
 * Cumple con la Sección 4 de la planificación para la carga y extensión del catálogo.
 *
 * Analiza la proporción de macronutrientes (% de energía proveniente de CHO, PRO y LIP),
 * la densidad calórica por 100g y sugiere el grupo de intercambio más compatible,
 * calculando los gramos equivalentes a 1 intercambio exacto.
 */
export function suggestExchangeFromNutrients100g(
  kcal100g: number,
  cho100g: number,
  pro100g: number,
  lip100g: number,
  groups: ExchangeGroup[]
): GroupSuggestionResult {
  // 1. Validación de consistencia Atwater 4/4/9
  const atwater = validateAtwater449(cho100g, pro100g, lip100g, kcal100g, 15);
  const effectiveKcal = kcal100g > 0 ? kcal100g : atwater.calculatedCalories;

  // 2. Proporciones porcentuales de energía por macro
  const choKcal = cho100g * 4;
  const proKcal = pro100g * 4;
  const lipKcal = lip100g * 9;
  const sumKcal = choKcal + proKcal + lipKcal || 1;

  const choPct = Math.round((choKcal / sumKcal) * 100);
  const proPct = Math.round((proKcal / sumKcal) * 100);
  const lipPct = Math.round((lipKcal / sumKcal) * 100);

  // 3. Reglas heurísticas y distancia euclidiana frente a los perfiles de los grupos
  let bestGroup: ExchangeGroup | undefined;
  let bestScore = Infinity;
  let rationale = '';

  // Heurísticas de dominio nutricional:
  if (effectiveKcal <= 25 && choPct > 50 && proPct <= 25) {
    // Verduras de libre consumo (bajísimas calorías)
    bestGroup = groups.find((g) => g.id === 'verduras-libre');
    rationale = 'Baja densidad calórica (<25 kcal/100g) y bajo tenor de lípidos, correspondiente a verduras de libre consumo.';
  } else if (effectiveKcal <= 55 && proPct <= 35 && choPct >= 50 && lipPct <= 10) {
    // Verduras generales
    bestGroup = groups.find((g) => g.id === 'verduras-generales');
    rationale = 'Densidad calórica moderada (~30-50 kcal/100g) predominante en carbohidratos complejos y fibra vegetal.';
  } else if (lipPct >= 70 && proPct <= 15) {
    // Grasas y aceites
    bestGroup = groups.find((g) => g.id === 'grasas-aceites');
    rationale = 'Aporte lipídico casi exclusivo (>70% de las calorías provenientes de grasas puras).';
  } else if (lipPct >= 55 && (proPct >= 10 || choPct >= 10)) {
    // Ricos en lípidos (semillas, frutos secos, aguacate)
    bestGroup = groups.find((g) => g.id === 'ricos-lipidos');
    rationale = 'Elevado tenor graso cardiosaludable acompañado de proteínas y carbohidratos (típico de frutos secos y aguacate).';
  } else if (proPct >= 45 && lipPct <= 35) {
    // Carnes bajas en grasa (magras)
    bestGroup = groups.find((g) => g.id === 'carnes-bg');
    rationale = 'Alto valor proteico (>45% de energía) con moderado a bajo tenor graso (aves, pescados, cortes vacunos magros).';
  } else if (proPct >= 35 && lipPct > 35) {
    // Carnes altas en grasa
    bestGroup = groups.find((g) => g.id === 'carnes-ag');
    rationale = 'Aporte sustancial de proteínas acompañado de moderado a alto porcentaje lipídico (cortes grasos o quesos duros).';
  } else if (choPct >= 80 && proPct <= 8 && lipPct <= 5 && effectiveKcal < 90) {
    // Frutas frescas
    bestGroup = groups.find((g) => g.id === 'frutas');
    rationale = 'Carbohidratos naturales (fructosa) y agua libre, con densidad típica de frutas frescas (~65 kcal por porción).';
  } else if (choPct >= 90 && effectiveKcal >= 250) {
    // Azúcares concentrados
    bestGroup = groups.find((g) => g.id === 'azucares');
    rationale = 'Carbohidratos simples de densidad concentrada (>90% CHO y >250 kcal/100g).';
  } else if (choPct >= 55 && proPct >= 15 && lipPct <= 10) {
    // Legumbres
    bestGroup = groups.find((g) => g.id === 'legumbres');
    rationale = 'Combinación característica de carbohidratos complejos de bajo índice glucémico y proteína vegetal (>15%).';
  } else if (choPct >= 50 && lipPct >= 25 && effectiveKcal >= 380) {
    // Galletas / Masas procesadas
    bestGroup = groups.find((g) => g.id === 'discrecional-galletas-ag' || g.id === 'discrecional-galletas-bg');
    rationale = 'Alta densidad calórica con combinación de harinas y grasas agregadas (perfil discrecional).';
  }

  // Si no encajó en ninguna heurística directa, calcular distancia cuadrática mínima con grupos base
  if (!bestGroup) {
    for (const group of groups) {
      if (group.isDiscretionary) continue; // Priorizar grupos base
      const gKcal = group.referenceMacros.calories;
      const gChoPct = (group.referenceMacros.carbohydrates * 4 / gKcal) * 100;
      const gProPct = (group.referenceMacros.proteins * 4 / gKcal) * 100;
      const gLipPct = (group.referenceMacros.lipids * 9 / gKcal) * 100;

      const dist = Math.sqrt(
        Math.pow(choPct - gChoPct, 2) * 1.2 +
        Math.pow(proPct - gProPct, 2) * 1.5 +
        Math.pow(lipPct - gLipPct, 2) * 1.2
      );

      if (dist < bestScore) {
        bestScore = dist;
        bestGroup = group;
      }
    }
    rationale = `Ajuste óptimo por proporciones de macronutrientes (${choPct}% CHO, ${proPct}% PRO, ${lipPct}% LIP) hacia ${bestGroup?.name || 'Cereales'}.`;
  }

  // Grupo por defecto si fallara
  const selectedGroup = bestGroup || groups[0];

  // 4. Gramos equivalentes a 1 intercambio del grupo seleccionado
  // Si 100g = effectiveKcal, entonces X g = selectedGroup.referenceMacros.calories
  let baseGrams = 0;
  if (effectiveKcal > 0) {
    baseGrams = Math.round((selectedGroup.referenceMacros.calories / effectiveKcal) * 100);
  }

  // Nivel de confianza
  let confidence: 'alta' | 'media' | 'baja' = 'alta';
  if (!atwater.isValid) {
    confidence = 'baja';
    rationale += ` ⚠️ Aviso: Los macronutrientes declarados presentan una desviación de ${atwater.diffPercent}% frente a las calorías declaradas.`;
  } else if (bestScore > 40) {
    confidence = 'media';
  }

  return {
    suggestedGroup: selectedGroup,
    confidence,
    baseGramsFor1Exchange: baseGrams,
    reason: rationale,
    macroProportions: {
      choPct,
      proPct,
      lipPct,
    },
    atwaterValidation: {
      isValid: atwater.isValid,
      calculatedKcal: atwater.calculatedCalories,
      diffPercent: atwater.diffPercent,
    },
  };
}
