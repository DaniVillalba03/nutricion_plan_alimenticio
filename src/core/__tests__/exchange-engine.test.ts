import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  formatFriendlyFraction,
  validateAtwater449,
  checkFoodExclusion,
  getFoodEquivalents,
  calculatePlanTotals,
} from '../exchange-engine';
import { suggestExchangeFromNutrients100g, FoodInputSchema } from '../validators';
import {
  MOCK_EXCHANGE_GROUPS,
  MOCK_FOODS,
  MOCK_CLIENTS,
  MOCK_INITIAL_PLAN,
  MOCK_PLAN_TEMPLATES,
} from '@/lib/mock-data';

describe('Exchange Engine - Pure Business Logic', () => {
  it('normalizes regional names, accents and guarani apostrophes', () => {
    expect(normalizeText("Mandi'ó")).toBe('mandio');
    expect(normalizeText('PORORÓ')).toBe('pororo');
    expect(normalizeText('Chipa Almidón')).toBe('chipa almidon');
    expect(normalizeText('Kumandá pytã')).toBe('kumanda pyta');
  });

  it('formats friendly household fractions accurately', () => {
    expect(formatFriendlyFraction(0.25)).toBe('¼');
    expect(formatFriendlyFraction(0.5)).toBe('½');
    expect(formatFriendlyFraction(0.75)).toBe('¾');
    expect(formatFriendlyFraction(1.0)).toBe('1');
    expect(formatFriendlyFraction(1.5)).toBe('1 ½');
    expect(formatFriendlyFraction(1.25)).toBe('1 ¼');
    expect(formatFriendlyFraction(2.0)).toBe('2');
  });

  it('validates Atwater 4/4/9 for base exchange groups', () => {
    // Cereales: 30g CHO * 4 + 3g PRO * 4 + 1g LIP * 9 = 120 + 12 + 9 = 141 kcal ≈ 140
    const cerealesCheck = validateAtwater449(30, 3, 1, 140);
    expect(cerealesCheck.isValid).toBe(true);

    // Carnes BG: 1g CHO + 11g PRO * 4 + 2g LIP * 9 = 4 + 44 + 18 = 66 kcal ≈ 65
    const carnesCheck = validateAtwater449(1, 11, 2, 65);
    expect(carnesCheck.isValid).toBe(true);

    // Frutas: 15g CHO * 4 + 1g PRO * 4 + 0g LIP * 9 = 64 kcal ≈ 65
    const frutasCheck = validateAtwater449(15, 1, 0, 65);
    expect(frutasCheck.isValid).toBe(true);
  });

  it('flags excluded foods for client restrictions (e.g. María: Lactosa and Carne Roja)', () => {
    const maria = MOCK_CLIENTS[0]; // Exclusions: ['Lactosa', 'Carne roja']
    const queso = MOCK_FOODS.find((f) => f.id === 'food-queso-paraguay')!;
    const lomo = MOCK_FOODS.find((f) => f.id === 'food-lomo-lomito-peceto')!;
    const pollo = MOCK_FOODS.find((f) => f.id === 'food-pechuga-pollo')!;

    expect(checkFoodExclusion(queso, maria.exclusions).isExcluded).toBe(true);
    expect(checkFoodExclusion(lomo, maria.exclusions).isExcluded).toBe(true);
    expect(checkFoodExclusion(pollo, maria.exclusions).isExcluded).toBe(false);
  });

  it('flags gluten for celiac client (Carlos: Gluten)', () => {
    const carlos = MOCK_CLIENTS[1]; // Exclusions: ['Gluten']
    const panFelipe = MOCK_FOODS.find((f) => f.id === 'food-pan-felipe')!;
    const mandioca = MOCK_FOODS.find((f) => f.id === 'food-mandioca-cocida')!;
    const chipa = MOCK_FOODS.find((f) => f.id === 'food-chipa-argolla')!;

    expect(checkFoodExclusion(panFelipe, carlos.exclusions).isExcluded).toBe(true);
    expect(checkFoodExclusion(mandioca, carlos.exclusions).isExcluded).toBe(false);
    expect(checkFoodExclusion(chipa, carlos.exclusions).isExcluded).toBe(false);
  });

  it('calculates equivalents with exact grams and friendly fractions for 1.5 exchanges of Cereales', () => {
    const equivalents = getFoodEquivalents('cereales-almidones', 1.5, MOCK_FOODS, MOCK_CLIENTS[0]);

    const mandioca = equivalents.find((e) => e.food.id === 'food-mandioca-cocida');
    expect(mandioca).toBeDefined();
    // 100g base * 1.5 = 150g, 1 trozo * 1.5 = 1 ½ trozo
    expect(mandioca?.calculatedGrams).toBe(150);
    expect(mandioca?.formattedHousehold).toContain('1 ½ trozo (150 g)');
  });

  it('calculates live plan totals matching client goals', () => {
    const client = MOCK_CLIENTS[0];
    const totals = calculatePlanTotals(MOCK_INITIAL_PLAN, MOCK_EXCHANGE_GROUPS, client);

    expect(totals.calories.current).toBeGreaterThan(1000);
    expect(totals.carbohydrates.current).toBeGreaterThan(0);
    expect(totals.proteins.current).toBeGreaterThan(0);
    expect(totals.lipids.current).toBeGreaterThan(0);
    expect(totals.totalExchanges).toBeGreaterThan(5);
  });
});

describe('Tarea 3 - Patient Portal, Equivalents & Templates Features', () => {
  it('filters out restricted foods when generating allowed equivalents for the Patient Portal', () => {
    const maria = MOCK_CLIENTS[0]; // Restricciones: Lactosa, Carne roja
    const equivalents = getFoodEquivalents('lacteos-bg', 1.0, MOCK_FOODS, maria);
    const allowed = equivalents.filter((eq) => !eq.isExcluded);

    // Lactosa debe estar excluida para María
    expect(equivalents.some((eq) => eq.food.id === 'food-leche-descremada' && eq.isExcluded)).toBe(true);
    expect(allowed.some((eq) => eq.food.id === 'food-leche-descremada')).toBe(false);
  });

  it('supports searching equivalents by Paraguayan synonyms and aliases', () => {
    // Buscar "yuca" debe encontrar Mandioca
    const resultsYuca = getFoodEquivalents('cereales-almidones', 1.0, MOCK_FOODS, undefined, 'yuca');
    expect(resultsYuca.some((eq) => eq.food.name.toLowerCase().includes('mandioca'))).toBe(true);

    // Buscar "pakova" debe encontrar Banana
    const resultsPakova = getFoodEquivalents('frutas', 1.0, MOCK_FOODS, undefined, 'pakova');
    expect(resultsPakova.some((eq) => eq.food.aliases.includes('pakova'))).toBe(true);

    // Buscar "locote" debe encontrar pimiento / locote en verduras de libre consumo
    const resultsLocote = getFoodEquivalents('verduras-libre', 1.0, MOCK_FOODS, undefined, 'locote');
    expect(resultsLocote.some((eq) => eq.food.name.toLowerCase().includes('locote'))).toBe(true);
  });

  it('verifies the 3 pre-defined clinical templates meet energetic standards', () => {
    expect(MOCK_PLAN_TEMPLATES).toHaveLength(3);

    const descenso = MOCK_PLAN_TEMPLATES.find((t) => t.id === 'template-descenso-1500');
    expect(descenso).toBeDefined();
    expect(descenso?.targetKcal).toBe(1500);
    expect(descenso?.meals.length).toBeGreaterThanOrEqual(4);

    const normo = MOCK_PLAN_TEMPLATES.find((t) => t.id === 'template-normocalorico-1800');
    expect(normo).toBeDefined();
    expect(normo?.targetKcal).toBe(1800);

    const deport = MOCK_PLAN_TEMPLATES.find((t) => t.id === 'template-deportivo-2200');
    expect(deport).toBeDefined();
    expect(deport?.targetKcal).toBe(2200);
  });
});

describe('Validators and 100g Exchange Suggester', () => {
  it('validates a complete Food item via Zod FoodInputSchema', () => {
    const validFood = {
      name: 'Mandioca frita casera',
      groupId: 'cereales-almidones',
      state: 'cocido' as const,
      baseGrams: 80,
      householdQty: 1,
      householdUnit: 'porción chica',
      portionDescription: '1 porción chica (80g)',
      aliases: ['yuca frita'],
      isParaguayanMarked: true,
      countryOrigin: 'PY',
    };

    const result = FoodInputSchema.safeParse(validFood);
    expect(result.success).toBe(true);
  });

  it('suggests Carnes BG for high-protein food (e.g. pechuga cruda ~120 kcal, 0g CHO, 23g PRO, 2g LIP)', () => {
    // 23g PRO * 4 = 92 kcal, 2g LIP * 9 = 18 kcal -> 110 kcal / 100g
    const suggestion = suggestExchangeFromNutrients100g(115, 0, 23, 2.5, MOCK_EXCHANGE_GROUPS);

    expect(suggestion.suggestedGroup.id).toBe('carnes-bg');
    expect(suggestion.macroProportions.proPct).toBeGreaterThan(70);
    // Base grams = (65 / 115) * 100 ≈ 57g
    expect(suggestion.baseGramsFor1Exchange).toBeGreaterThan(50);
    expect(suggestion.baseGramsFor1Exchange).toBeLessThan(65);
  });

  it('suggests Cereales y Almidones for a grain/bread product (~250 kcal, 50g CHO, 8g PRO, 2g LIP)', () => {
    const suggestion = suggestExchangeFromNutrients100g(250, 50, 8, 2, MOCK_EXCHANGE_GROUPS);

    expect(suggestion.suggestedGroup.id).toBe('cereales-almidones');
    expect(suggestion.macroProportions.choPct).toBeGreaterThan(70);
    // Base grams = (140 / 250) * 100 = 56g
    expect(suggestion.baseGramsFor1Exchange).toBe(56);
  });

  it('suggests Grasas y Aceites for pure fat item (~880 kcal, 0g CHO, 0g PRO, 98g LIP)', () => {
    const suggestion = suggestExchangeFromNutrients100g(884, 0, 0, 98, MOCK_EXCHANGE_GROUPS);

    expect(suggestion.suggestedGroup.id).toBe('grasas-aceites');
    expect(suggestion.macroProportions.lipPct).toBeGreaterThan(95);
    // Base grams = (180 / 884) * 100 ≈ 20g
    expect(suggestion.baseGramsFor1Exchange).toBe(20);
  });

  it('suggests Verduras de Libre Consumo for leafy greens (~15 kcal, 3g CHO, 1g PRO, 0.2g LIP)', () => {
    const suggestion = suggestExchangeFromNutrients100g(18, 3, 1, 0.2, MOCK_EXCHANGE_GROUPS);

    expect(suggestion.suggestedGroup.id).toBe('verduras-libre');
    expect(suggestion.baseGramsFor1Exchange).toBeGreaterThan(50);
  });
});
