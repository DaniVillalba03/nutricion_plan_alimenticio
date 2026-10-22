/**
 * MOTOR DE INTERCAMBIO PURO (Exchange Engine)
 * Lógica de negocio nutricional desacoplada de la UI.
 * Cumple con validación 4/4/9, redondeo amigable de medidas caseras,
 * búsqueda con sinónimos regionales y filtrado de exclusiones del cliente.
 */

import {
  Client,
  ExchangeGroup,
  Food,
  FoodEquivalent,
  MealPlan,
  PlanTotals,
  MacroSummary,
} from '@/types/nutrition';

/**
 * Normaliza un string para comparaciones y búsquedas:
 * Convierte a minúsculas, elimina tildes y diacríticos, y quita puntuación.
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Elimina acentos/tildes
    .replace(/['’´`]/g, '')         // Elimina apóstrofes típicos de guaraní (ej. mandi'o)
    .trim();
}

/**
 * Valida la consistencia calórica de macronutrientes según la regla Atwater 4/4/9:
 * (CHO * 4) + (PRO * 4) + (LIP * 9) ≈ Kcal
 * Retorna true si la discrepancia es menor a un umbral (por defecto 10%).
 */
export function validateAtwater449(
  carbs: number,
  protein: number,
  lipids: number,
  statedCalories: number,
  tolerancePercent = 10
): { isValid: boolean; calculatedCalories: number; difference: number; diffPercent: number } {
  const calculatedCalories = carbs * 4 + protein * 4 + lipids * 9;
  if (statedCalories === 0) {
    return {
      isValid: calculatedCalories === 0,
      calculatedCalories,
      difference: calculatedCalories,
      diffPercent: 0,
    };
  }
  const difference = Math.abs(calculatedCalories - statedCalories);
  const diffPercent = (difference / statedCalories) * 100;
  return {
    isValid: diffPercent <= tolerancePercent,
    calculatedCalories,
    difference,
    diffPercent: Math.round(diffPercent * 10) / 10,
  };
}

/**
 * Convierte una cantidad numérica a una fracción amigable y legible para el paciente:
 * Ejemplos:
 * 0.25 -> "¼"
 * 0.33 -> "⅓"
 * 0.5  -> "½"
 * 0.66 -> "⅔"
 * 0.75 -> "¾"
 * 1.25 -> "1 ¼"
 * 1.5  -> "1 ½"
 * 1.75 -> "1 ¾"
 * 2.0  -> "2"
 */
export function formatFriendlyFraction(quantity: number): string {
  if (quantity <= 0) return '0';

  const integerPart = Math.floor(quantity);
  const decimalPart = Math.round((quantity - integerPart) * 100) / 100;

  let fractionStr = '';

  // Detección con margen de tolerancia para decimales comunes
  if (Math.abs(decimalPart - 0.25) <= 0.04) {
    fractionStr = '¼';
  } else if (Math.abs(decimalPart - 0.33) <= 0.05) {
    fractionStr = '⅓';
  } else if (Math.abs(decimalPart - 0.5) <= 0.05) {
    fractionStr = '½';
  } else if (Math.abs(decimalPart - 0.66) <= 0.05 || Math.abs(decimalPart - 0.67) <= 0.05) {
    fractionStr = '⅔';
  } else if (Math.abs(decimalPart - 0.75) <= 0.04) {
    fractionStr = '¾';
  } else if (decimalPart >= 0.95) {
    return `${integerPart + 1}`;
  } else if (decimalPart > 0.05) {
    // Si no encaja en una fracción típica, redondeamos a 1 decimal
    const rounded = Math.round(quantity * 10) / 10;
    return `${rounded}`;
  }

  if (integerPart === 0) {
    return fractionStr || `${quantity}`;
  }

  if (fractionStr) {
    return `${integerPart} ${fractionStr}`;
  }

  return `${integerPart}`;
}

/**
 * Comprueba si un alimento contiene alguna de las restricciones o exclusiones de un cliente.
 */
export function checkFoodExclusion(food: Food, exclusions: string[]): { isExcluded: boolean; reason?: string } {
  if (!exclusions || exclusions.length === 0) {
    return { isExcluded: false };
  }

  const normalizedName = normalizeText(food.name);
  const normalizedAliases = food.aliases.map(normalizeText);
  const normalizedTags = (food.tags || []).map(normalizeText);

  // Tags positivos (sin prefijo 'sin' o 'libre de')
  const positiveTags = normalizedTags.filter((t) => !t.startsWith('sin ') && !t.startsWith('libre '));
  const negativeTags = normalizedTags.filter((t) => t.startsWith('sin ') || t.startsWith('libre '));

  for (const exclusion of exclusions) {
    const normExclusion = normalizeText(exclusion);

    // 1. Verificación de Lactosa
    if (normExclusion.includes('lactos')) {
      const isLactoseFree = negativeTags.some((t) => t.includes('lactosa') || t.includes('lacteos')) ||
        normalizedName.includes('deslactosad') || normalizedName.includes('sin lactosa');
      if (isLactoseFree) continue;

      const hasLactose =
        positiveTags.some((t) => t.includes('lactosa')) ||
        food.groupId.startsWith('lacteos') ||
        normalizedName.includes('leche') ||
        normalizedName.includes('queso') ||
        normalizedName.includes('yogur');

      if (hasLactose) {
        return { isExcluded: true, reason: `Contiene lácteos / lactosa (Exclusión: ${exclusion})` };
      }
      continue;
    }

    // 2. Verificación de Gluten / Trigo
    if (normExclusion.includes('gluten') || normExclusion.includes('celiac')) {
      const isGlutenFree = negativeTags.some((t) => t.includes('gluten')) || normalizedName.includes('sin gluten');
      if (isGlutenFree) continue;

      const hasGluten =
        positiveTags.some((t) => t.includes('gluten')) ||
        normalizedName.includes('pan felipe') ||
        normalizedName.includes('trigo') ||
        normalizedName.includes('avena');

      if (hasGluten) {
        return { isExcluded: true, reason: `Contiene gluten / derivados de trigo (Exclusión: ${exclusion})` };
      }
      continue;
    }

    // 3. Verificación de Carne Roja
    if (normExclusion.includes('carne roja') || normExclusion.includes('vacun')) {
      const isRedMeat =
        positiveTags.includes('carne roja') ||
        normalizedName.includes('carnaza') ||
        normalizedName.includes('lomo') ||
        normalizedName.includes('vacun') ||
        normalizedName.includes('bife');

      if (isRedMeat) {
        return { isExcluded: true, reason: `Carne roja vacuna (Exclusión: ${exclusion})` };
      }
      continue;
    }

    // 4. Verificación de Cerdo
    if (normExclusion.includes('cerdo') || normExclusion.includes('kure')) {
      const isPork =
        positiveTags.includes('cerdo') ||
        normalizedName.includes('cerdo') ||
        normalizedName.includes('puerco') ||
        normalizedName.includes('chancho');

      if (isPork) {
        return { isExcluded: true, reason: `Derivado de cerdo (Exclusión: ${exclusion})` };
      }
      continue;
    }

    // 5. Coincidencia genérica (sólo en nombre, alias y tags afirmativos)
    const termsToMatch = [normalizedName, ...normalizedAliases, ...positiveTags];
    for (const term of termsToMatch) {
      if (term.includes(normExclusion)) {
        return { isExcluded: true, reason: `Restricción del cliente: ${exclusion}` };
      }
    }
  }

  return { isExcluded: false };
}

/**
 * Calcula los alimentos equivalentes para un ítem del plan nutricional.
 * Para cada alimento del mismo grupo:
 * - Calcula gramos exactos: `baseGrams * exchangeCount`
 * - Calcula medida casera exacta: `householdQty * exchangeCount`
 * - Formatea la medida casera a fracción amigable
 * - Determina si está restringido según las exclusiones del cliente
 */
export function getFoodEquivalents(
  groupId: string,
  exchangeCount: number,
  allFoods: Food[],
  client?: Client | null,
  searchQuery?: string
): FoodEquivalent[] {
  // Filtrar alimentos del mismo grupo
  let foodsInGroup = allFoods.filter((f) => f.groupId === groupId);

  // Filtrar por término de búsqueda si se proporciona (busca en nombre y en sinónimos regionales de Paraguay)
  if (searchQuery && searchQuery.trim().length > 0) {
    const normalizedQuery = normalizeText(searchQuery);
    foodsInGroup = foodsInGroup.filter((f) => {
      const matchName = normalizeText(f.name).includes(normalizedQuery);
      const matchAlias = f.aliases.some((alias) => normalizeText(alias).includes(normalizedQuery));
      return matchName || matchAlias;
    });
  }

  const exclusions = client?.exclusions || [];

  return foodsInGroup.map((food) => {
    const calculatedGrams = Math.round(food.baseGrams * exchangeCount);
    const calculatedHouseholdQty = Math.round(food.householdQty * exchangeCount * 100) / 100;
    const formattedQty = formatFriendlyFraction(calculatedHouseholdQty);
    const formattedHousehold = `${formattedQty} ${food.householdUnit} (${calculatedGrams} g)`;

    const exclusionCheck = checkFoodExclusion(food, exclusions);

    return {
      food,
      calculatedGrams,
      calculatedHouseholdQty,
      householdUnit: food.householdUnit,
      formattedHousehold,
      isExcluded: exclusionCheck.isExcluded,
      exclusionReason: exclusionCheck.reason,
    };
  });
}

/**
 * Calcula los totales nutricionales en vivo de un plan de alimentación completo
 * frente a las metas calóricas y de macronutrientes del cliente activo.
 */
export function calculatePlanTotals(
  plan: MealPlan,
  exchangeGroups: ExchangeGroup[],
  client: Client
): PlanTotals {
  const groupsMap = new Map<string, ExchangeGroup>(exchangeGroups.map((g) => [g.id, g]));

  let totalCalories = 0;
  let totalCarbs = 0;
  let totalProteins = 0;
  let totalLipids = 0;
  let totalExchanges = 0;
  const groupBreakdown: Record<string, number> = {};

  // Recorrer todas las comidas y los ítems
  for (const meal of plan.meals) {
    for (const item of meal.items) {
      const group = groupsMap.get(item.groupId);
      if (!group) continue;

      const exchanges = item.exchangeCount || 0;
      totalExchanges += exchanges;
      groupBreakdown[item.groupId] = (groupBreakdown[item.groupId] || 0) + exchanges;

      totalCalories += group.referenceMacros.calories * exchanges;
      totalCarbs += group.referenceMacros.carbohydrates * exchanges;
      totalProteins += group.referenceMacros.proteins * exchanges;
      totalLipids += group.referenceMacros.lipids * exchanges;
    }
  }

  // Redondeo de totales
  totalCalories = Math.round(totalCalories);
  totalCarbs = Math.round(totalCarbs);
  totalProteins = Math.round(totalProteins);
  totalLipids = Math.round(totalLipids);

  // Helper para generar el resumen por cada macronutriente
  const createSummary = (current: number, target: number, calorieMultiplier: number): MacroSummary => {
    const difference = Math.round((current - target) * 10) / 10;
    const percentageOfTarget = target > 0 ? Math.round((current / target) * 100) : 0;
    const distributionPct = totalCalories > 0 ? Math.round(((current * calorieMultiplier) / totalCalories) * 100) : 0;

    return {
      current,
      target,
      difference,
      percentageOfTarget,
      distributionPct,
    };
  };

  return {
    calories: {
      current: totalCalories,
      target: client.targetCalories,
      difference: Math.round(totalCalories - client.targetCalories),
      percentageOfTarget: client.targetCalories > 0 ? Math.round((totalCalories / client.targetCalories) * 100) : 0,
      distributionPct: 100,
    },
    carbohydrates: createSummary(totalCarbs, client.targetMacros.carbohydrates, 4),
    proteins: createSummary(totalProteins, client.targetMacros.proteins, 4),
    lipids: createSummary(totalLipids, client.targetMacros.lipids, 9),
    totalExchanges: Math.round(totalExchanges * 100) / 100,
    groupBreakdown,
  };
}

/**
 * Preset de cantidades de intercambios rápidos para la interfaz
 */
export const QUICK_EXCHANGE_PRESETS: number[] = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0];
