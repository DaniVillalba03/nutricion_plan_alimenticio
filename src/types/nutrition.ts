/**
 * Tipos e interfaces del Sistema de Planificación Nutricional por Intercambios
 * Basado en las tablas de intercambio de la Lic. Laura Molinas (Reg. Prof. 6020) adaptadas a Paraguay.
 */

export type FoodState = 'crudo' | 'cocido' | 'no_aplica';
export type GroupCategory = 'base' | 'discrecional';
export type Gender = 'masculino' | 'femenino';

export interface MacroNutrients {
  calories: number;       // kcal
  carbohydrates: number;  // g
  proteins: number;       // g
  lipids: number;         // g
}

export interface MacroDistribution {
  carbohydrates: number;  // % (ej. 50%)
  proteins: number;       // % (ej. 20%)
  lipids: number;         // % (ej. 30%)
}

export interface ExchangeGroup {
  id: string;
  code: string;           // ej. 'CEREALES_ALMIDONES', 'LEGUMBRES', 'FRUTAS'
  name: string;
  shortName: string;
  category: GroupCategory;
  referenceMacros: MacroNutrients;
  tolerancePct?: number;  // ej. 10%
  isDiscretionary?: boolean;
  isFreeConsumption?: boolean;
  color: {
    bg: string;
    text: string;
    border: string;
    badge: string;
    accent: string;
  };
  description?: string;
  educationalWarning?: string;
}

export interface ExchangeSubgroup {
  id: string;
  groupId: string;
  code?: string;
  name: string;
  description?: string;
}

export interface Food {
  id: string;
  name: string;
  aliases: string[];            // Sinónimos regionales en Paraguay (ej. mandioca, yuca, locote, etc.)
  groupId: string;
  subgroupId?: string;
  state: FoodState;
  baseGrams: number;            // Gramos correspondientes a 1 intercambio exacto
  householdQty: number;         // Cantidad en medida casera para 1 intercambio (ej. 1, 0.5)
  householdUnit: string;        // Medida casera (ej. 'taza', 'unidad mediana', 'cuchara sopera', 'feta')
  portionDescription: string;   // Resumen legible (ej. '½ unidad mediana (100g)')
  isParaguayanMarked?: boolean; // True si tiene sello comercial / local paraguayo (*)
  brand?: string;               // Marca (ej. 'La Palmera', 'Bimbo', 'Orowheat', 'Hijas de Feliciana')
  countryOrigin?: string;       // ej. 'PY'
  source?: string;              // ej. 'Lic. Laura Molinas'
  tags?: string[];              // Etiquetas (ej. 'sin gluten', 'vegetariano', 'sin lactosa')
  notes?: string;
}

export interface Client {
  id: string;
  nutritionistId?: string;
  fullName: string;
  email?: string;
  phone?: string;
  age: number;
  gender: Gender;
  weightKg?: number;
  heightCm?: number;
  activityLevel?: string;
  targetCalories: number;
  targetMacros: {
    carbohydrates: number;      // gramos meta
    proteins: number;           // gramos meta
    lipids: number;             // gramos meta
  };
  macroDistributionPct: MacroDistribution;
  exclusions: string[];         // Alimentos o alérgenos excluidos (ej. 'Lactosa', 'Gluten', 'Carne roja')
  notes?: string;
  shareToken?: string;          // Token seguro para el portal móvil /p/[token]
  isShareRevoked?: boolean;     // Revocación manual de acceso
  shareExpiresAt?: string;      // Fecha de expiración (ISO) o null
}

export interface MealPlanItem {
  id: string;
  groupId: string;
  subgroupId?: string;
  exchangeCount: number;        // Cantidad de intercambios (ej. 0.25, 0.5, 0.75, 1, 1.5, 2)
  selectedFoodId?: string;      // Alimento sugerido específico (opcional)
  notes?: string;
}

export interface MealPlanMeal {
  id: string;
  name: string;                 // ej. 'Desayuno', 'Media Mañana', 'Almuerzo', 'Merienda', 'Cena'
  time?: string;                // ej. '07:30'
  items: MealPlanItem[];
  isCompleted?: boolean;        // Registro de adherencia diaria
}

export interface PlanVersion {
  id: string;
  planId: string;
  versionNumber: number;        // 1.0, 2.0, etc.
  createdAt: string;
  changeNote?: string;          // ej. "Ajuste de carbohidratos en merienda"
  meals: MealPlanMeal[];
  isActive: boolean;
}

export interface MealPlan {
  id: string;
  clientId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  meals: MealPlanMeal[];
  versionNumber?: number;       // Versión activa actual
  versionNote?: string;         // Nota de la versión activa (por qué se creó)
  versions?: PlanVersion[];     // Historial de versiones del plan
  shareToken?: string;
  isShareRevoked?: boolean;
  shareExpiresAt?: string;
}

export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  targetKcal: number;
  macroDistribution: MacroDistribution;
  meals: MealPlanMeal[];
}

export interface MacroSummary {
  current: number;
  target: number;
  difference: number;
  percentageOfTarget: number;
  distributionPct: number;      // % calórico real que aporta al total
}

export interface PlanTotals {
  calories: MacroSummary;
  carbohydrates: MacroSummary;
  proteins: MacroSummary;
  lipids: MacroSummary;
  totalExchanges: number;
  groupBreakdown: Record<string, number>; // groupId -> total de intercambios
}

export interface FoodEquivalent {
  food: Food;
  calculatedGrams: number;
  calculatedHouseholdQty: number;
  householdUnit: string;
  formattedHousehold: string;   // ej. "1 ½ taza", "¾ unidad", "200 g"
  isExcluded: boolean;
  exclusionReason?: string;
}

export interface FoodNutrients100g {
  kcal100g: number;
  cho100g: number;
  pro100g: number;
  lip100g: number;
}

export interface GroupSuggestionResult {
  suggestedGroup: ExchangeGroup;
  confidence: 'alta' | 'media' | 'baja';
  baseGramsFor1Exchange: number;
  reason: string;
  macroProportions: {
    choPct: number;
    proPct: number;
    lipPct: number;
  };
  atwaterValidation: {
    isValid: boolean;
    calculatedKcal: number;
    diffPercent: number;
  };
}

/** Control periódico de un paciente (peso y medidas). Uno por día. */
export interface Measurement {
  id: string;
  measuredOn: string;      // AAAA-MM-DD
  weightKg: number;
  bodyFatPct?: number;
  waistCm?: number;
  notes?: string;
}

/** Comidas completadas por el paciente en su portal un día concreto. */
export interface AdherenceDay {
  day: string;             // AAAA-MM-DD
  completed: number;
  total: number;
}
