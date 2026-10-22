'use server';

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { FoodInputSchema, ImportRowSchema, suggestExchangeFromNutrients100g } from '@/core/validators';
import { validateAtwater449 } from '@/core/exchange-engine';
import { FOOD_SELECT, mapDbFoods, type DbFoodRow } from '@/core/catalog';
import { MOCK_EXCHANGE_GROUPS, MOCK_FOODS } from '@/lib/mock-data';
import type { Food } from '@/types/nutrition';
import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser, SESSION_EXPIRED } from './shared';

// ==============================================================================
// 0. CATÁLOGO DE ALIMENTOS
// ==============================================================================

/**
 * Catálogo de alimentos desde la base de datos. Es lectura pública (el portal del paciente
 * también la necesita). Sin Supabase, o si la consulta falla, se usa el catálogo de ejemplo
 * para que la app siga funcionando.
 */
export async function getCatalogAction(): Promise<Food[]> {
  if (!isSupabaseConfigured()) return MOCK_FOODS;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('foods').select(FOOD_SELECT).eq('is_active', true).order('name');
    if (error || !data) return MOCK_FOODS;
    const foods = mapDbFoods(data as unknown as DbFoodRow[]);
    return foods.length > 0 ? foods : MOCK_FOODS;
  } catch {
    return MOCK_FOODS;
  }
}

/** Agrega un alimento propio de la nutricionista al catálogo (con su porción y sinónimos). */
export async function createFoodAction(rawInput: unknown): Promise<{ success: boolean; food?: Food; error?: string }> {
  const parsed = FoodInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
  }
  const input = parsed.data;

  const user = await getAuthenticatedUser();
  if (user.unauthenticated) return { success: false, error: SESSION_EXPIRED };

  const id = `food-custom-${crypto.randomUUID().slice(0, 12)}`;
  const food: Food = { ...input, id, source: 'Nutricionista', tags: input.tags };

  // Modo demostración: el alimento vive solo en la pantalla
  if (!isSupabaseConfigured() || user.isDemo) return { success: true, food };

  try {
    const supabase = await createClient();

    const { data: units } = await supabase.from('measure_units').select('id, name');
    const unitId =
      (units ?? []).find((u: { id: string; name: string }) => u.name.toLowerCase() === input.householdUnit.toLowerCase())?.id ??
      null;

    const { error: foodError } = await supabase.from('foods').insert({
      id,
      name: input.name,
      group_id: input.groupId,
      subgroup_id: input.subgroupId || null,
      state: input.state,
      country_origin: input.countryOrigin,
      brand: input.brand || null,
      is_paraguayan_marked: input.isParaguayanMarked,
      source: 'Nutricionista',
      notes: input.notes || null,
      created_by: user.id,
    });
    if (foodError) return { success: false, error: foodError.message };

    const { error: portionError } = await supabase.from('food_portions').insert({
      food_id: id,
      grams: input.baseGrams,
      household_qty: input.householdQty,
      measure_unit_id: unitId,
      notes: input.portionDescription,
    });
    if (portionError) {
      await supabase.from('foods').delete().eq('id', id); // sin porción el alimento no sirve: no queda a medias
      return { success: false, error: portionError.message };
    }

    if (input.aliases.length > 0) {
      await supabase.from('food_aliases').insert(input.aliases.map((alias) => ({ food_id: id, alias })));
    }

    revalidatePath('/dashboard/foods');
    return { success: true, food };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado' };
  }
}


// ==============================================================================
// 4. IMPORTADOR MASIVO Y VALIDADOR ATWATER 4/4/9
// ==============================================================================

export interface ProcessedImportRow {
  id: string;
  name: string;
  kcal100g: number;
  cho100g: number;
  pro100g: number;
  lip100g: number;
  atwater: {
    calculatedCalories: number;
    diffPercent: number;
    isValid: boolean;
  };
  suggestedGroup: {
    id: string;
    name: string;
    shortName: string;
    accent: string;
  };
  baseGrams: number;
  status: 'approved' | 'needs_review' | 'error';
  validationMessage: string;
}

export async function validateAndImportFoodsAction(
  rawText: string,
  sourceName: string = 'Importación Manual'
): Promise<{
  success: boolean;
  batchId?: string;
  totalRows: number;
  approvedCount: number;
  reviewCount: number;
  rows: ProcessedImportRow[];
  error?: string;
}> {
  if (!rawText || rawText.trim().length === 0) {
    return {
      success: false,
      totalRows: 0,
      approvedCount: 0,
      reviewCount: 0,
      rows: [],
      error: 'El texto de importación está vacío',
    };
  }

  const lines = rawText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const processedRows: ProcessedImportRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ignorar cabecera si contiene palabras clave
    if (i === 0 && (line.toLowerCase().includes('nombre') || line.toLowerCase().includes('kcal'))) {
      continue;
    }

    // Dividir por coma, punto y coma o tabulación
    const parts = line.split(/[,;\t]+/).map((p) => p.trim());
    if (parts.length < 5) continue;

    const [nombre, rawKcal, rawCho, rawPro, rawLip] = parts;

    const parseResult = ImportRowSchema.safeParse({
      nombre,
      kcal_100g: Number(rawKcal) || 0,
      cho_100g: Number(rawCho) || 0,
      pro_100g: Number(rawPro) || 0,
      lip_100g: Number(rawLip) || 0,
    });

    if (!parseResult.success) continue;

    const { nombre: validName, kcal_100g, cho_100g, pro_100g, lip_100g } = parseResult.data;
    const kcal = kcal_100g || 0;
    const cho = cho_100g || 0;
    const pro = pro_100g || 0;
    const lip = lip_100g || 0;

    // Validación Atwater 4/4/9
    const atwaterCheck = validateAtwater449(cho, pro, lip, kcal, 15);

    // Sugerencia de grupo de intercambio
    const suggestion = suggestExchangeFromNutrients100g(
      kcal,
      cho,
      pro,
      lip,
      MOCK_EXCHANGE_GROUPS
    );

    let status: 'approved' | 'needs_review' | 'error' = 'approved';
    let validationMessage = 'Consistencia calórica verificada (Atwater 4/4/9)';

    if (!atwaterCheck.isValid) {
      if (atwaterCheck.diffPercent > 20) {
        status = 'needs_review';
        validationMessage = `Discrepancia Atwater de ${atwaterCheck.diffPercent}%: Kcal declaradas (${kcal}) difieren de las calculadas (${atwaterCheck.calculatedCalories}).`;
      } else {
        status = 'needs_review';
        validationMessage = `Margen de tolerancia límite (${atwaterCheck.diffPercent}% diff).`;
      }
    } else if (suggestion.confidence === 'baja') {
      status = 'needs_review';
      validationMessage = 'Grupo sugerido con confianza media/baja. Requiere revisión de la nutricionista.';
    }

    processedRows.push({
      id: `imp-${i}-${Date.now()}`,
      name: validName,
      kcal100g: kcal,
      cho100g: cho,
      pro100g: pro,
      lip100g: lip,
      atwater: {
        calculatedCalories: atwaterCheck.calculatedCalories,
        diffPercent: atwaterCheck.diffPercent,
        isValid: atwaterCheck.isValid,
      },
      suggestedGroup: {
        id: suggestion.suggestedGroup.id,
        name: suggestion.suggestedGroup.name,
        shortName: suggestion.suggestedGroup.shortName,
        accent: suggestion.suggestedGroup.color.accent,
      },
      baseGrams: suggestion.baseGramsFor1Exchange,
      status,
      validationMessage,
    });
  }

  const approvedCount = processedRows.filter((r) => r.status === 'approved').length;
  const reviewCount = processedRows.filter((r) => r.status === 'needs_review').length;

  // Si Supabase está configurado, guardar lote en import_batches e import_rows
  const configured = isSupabaseConfigured();
  let batchId: string | undefined;

  if (configured) {
    try {
      const user = await getAuthenticatedUser();
      const supabase = await createClient();

      const { data: batch } = await supabase
        .from('import_batches')
        .insert({
          nutritionist_id: user.id,
          source_name: sourceName,
          status: reviewCount > 0 ? 'needs_review' : 'approved',
          total_rows: processedRows.length,
        })
        .select()
        .single();

      if (batch) {
        batchId = batch.id;
        const rowsToInsert = processedRows.map((r) => ({
          batch_id: batch.id,
          raw_data: {
            name: r.name,
            kcal_100g: r.kcal100g,
            cho_100g: r.cho100g,
            pro_100g: r.pro100g,
            lip_100g: r.lip100g,
            suggested_group: r.suggestedGroup.id,
            base_grams: r.baseGrams,
          },
          status: r.status,
          validation_errors: r.status !== 'approved' ? [r.validationMessage] : [],
        }));

        await supabase.from('import_rows').insert(rowsToInsert);
      }
    } catch {
      // Continuar con los datos procesados en memoria
    }
  }

  return {
    success: true,
    batchId,
    totalRows: processedRows.length,
    approvedCount,
    reviewCount,
    rows: processedRows,
  };
}
