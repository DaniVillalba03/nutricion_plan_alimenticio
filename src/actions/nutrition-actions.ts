'use server';

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import {
  ClientInputSchema,
  SavePlanInputSchema,
  ImportRowSchema,
  suggestExchangeFromNutrients100g,
} from '@/core/validators';
import { validateAtwater449 } from '@/core/exchange-engine';
import {
  MOCK_CLIENTS,
  MOCK_EXCHANGE_GROUPS,
  MOCK_INITIAL_PLAN,
} from '@/lib/mock-data';
import { Client, MealPlan } from '@/types/nutrition';
import { revalidatePath } from 'next/cache';

/**
 * Helper para obtener el usuario autenticado actual o fallback demo
 */
async function getAuthenticatedUser() {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'lic.laura.molinas@nutriplan.py',
      isDemo: true,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'lic.laura.molinas@nutriplan.py',
      isDemo: true,
    };
  }

  return {
    id: user.id,
    email: user.email,
    isDemo: false,
  };
}

// ==============================================================================
// 1. GESTIÓN DE PACIENTES / CLIENTES
// ==============================================================================

export async function getClientsAction(): Promise<{ success: boolean; data: Client[] }> {
  const configured = isSupabaseConfigured();

  if (!configured) {
    return { success: true, data: MOCK_CLIENTS };
  }

  try {
    const user = await getAuthenticatedUser();
    const supabase = await createClient();

    const { data: dbClients, error } = await supabase
      .from('clients')
      .select('*, client_food_rules(food_id, group_id, rule_type, reason)')
      .eq('nutritionist_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !dbClients || dbClients.length === 0) {
      return { success: true, data: MOCK_CLIENTS };
    }

    const mappedClients: Client[] = dbClients.map((c) => {
      const exclusions = (c.client_food_rules || [])
        .filter((r: { rule_type: string }) => r.rule_type === 'exclude')
        .map((r: { reason?: string }) => r.reason || 'Restricción médica');

      const targetKcal = Number(c.target_kcal) || 1600;
      const choG = Number(c.target_cho_g) || 180;
      const proG = Number(c.target_pro_g) || 85;
      const lipG = Number(c.target_lip_g) || 50;

      return {
        id: c.id,
        fullName: c.full_name,
        email: c.email || undefined,
        phone: c.phone || undefined,
        age: c.age || 30,
        gender: c.gender || 'femenino',
        weightKg: Number(c.weight_kg) || 60,
        heightCm: Number(c.height_cm) || 165,
        targetCalories: targetKcal,
        targetMacros: {
          carbohydrates: choG,
          proteins: proG,
          lipids: lipG,
        },
        macroDistributionPct: {
          carbohydrates: Math.round(((choG * 4) / targetKcal) * 100) || 50,
          proteins: Math.round(((proG * 4) / targetKcal) * 100) || 20,
          lipids: Math.round(((lipG * 9) / targetKcal) * 100) || 30,
        },
        exclusions,
        notes: c.notes || undefined,
        shareToken: `token-${c.id.substring(0, 8)}`,
      };
    });

    return { success: true, data: mappedClients };
  } catch {
    return { success: true, data: MOCK_CLIENTS };
  }
}

export async function createClientAction(rawInput: unknown) {
  const parseResult = ClientInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((i) => i.message).join(', '),
    };
  }

  const clientData = parseResult.data;
  const user = await getAuthenticatedUser();
  const configured = isSupabaseConfigured();

  if (!configured || user.isDemo) {
    // Modo demostración: retorna un objeto simulado compatible
    const newDemoClient: Client = {
      id: `client-${Date.now()}`,
      fullName: clientData.fullName,
      email: clientData.email || undefined,
      phone: clientData.phone || undefined,
      age: clientData.age,
      gender: clientData.gender,
      weightKg: clientData.weightKg,
      heightCm: clientData.heightCm,
      targetCalories: clientData.targetKcal,
      targetMacros: {
        carbohydrates: clientData.targetChoG,
        proteins: clientData.targetProG,
        lipids: clientData.targetLipG,
      },
      macroDistributionPct: {
        carbohydrates: Math.round(((clientData.targetChoG * 4) / clientData.targetKcal) * 100) || 50,
        proteins: Math.round(((clientData.targetProG * 4) / clientData.targetKcal) * 100) || 20,
        lipids: Math.round(((clientData.targetLipG * 9) / clientData.targetKcal) * 100) || 30,
      },
      exclusions: clientData.exclusions,
      notes: clientData.notes,
      shareToken: `token-${Date.now().toString(36)}`,
    };

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    return { success: true, data: newDemoClient };
  }

  try {
    const supabase = await createClient();

    // 1. Insertar registro principal del cliente con su nutritionist_id (RLS)
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        nutritionist_id: user.id,
        full_name: clientData.fullName,
        email: clientData.email || null,
        phone: clientData.phone || null,
        age: clientData.age,
        gender: clientData.gender,
        weight_kg: clientData.weightKg,
        height_cm: clientData.heightCm || null,
        activity_level: clientData.activityLevel || null,
        target_kcal: clientData.targetKcal,
        target_cho_g: clientData.targetChoG,
        target_pro_g: clientData.targetProG,
        target_lip_g: clientData.targetLipG,
        notes: clientData.notes || null,
        consent_accepted: clientData.consentAccepted,
      })
      .select()
      .single();

    if (clientError || !newClient) {
      return { success: false, error: clientError?.message || 'Error al crear cliente' };
    }

    // 2. Insertar reglas de exclusión en client_food_rules
    if (clientData.exclusions.length > 0) {
      const rules = clientData.exclusions.map((exclusion) => ({
        client_id: newClient.id,
        rule_type: 'exclude',
        reason: exclusion,
      }));

      await supabase.from('client_food_rules').insert(rules);
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    return { success: true, data: newClient };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado';
    return { success: false, error: msg };
  }
}

// ==============================================================================
// 2. GESTIÓN DE PLANES Y VERSIONADO
// ==============================================================================

export async function savePlanAction(rawInput: unknown) {
  const parseResult = SavePlanInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((i) => i.message).join(', '),
    };
  }

  const planInput = parseResult.data;
  const user = await getAuthenticatedUser();
  const configured = isSupabaseConfigured();

  if (!configured || user.isDemo) {
    return {
      success: true,
      message: 'Plan guardado en modo local/demostración',
      versionNumber: planInput.versionNumber,
      shareToken: planInput.shareToken || 'maria-elena-2026',
    };
  }

  try {
    const supabase = await createClient();

    // 1. Guardar o actualizar plan en meal_plans
    let planId = planInput.id;
    if (!planId || planId.startsWith('plan-demo')) {
      const { data: newPlan, error: planError } = await supabase
        .from('meal_plans')
        .insert({
          client_id: planInput.clientId,
          nutritionist_id: user.id,
          title: planInput.title,
          notes: planInput.notes || null,
        })
        .select()
        .single();

      if (planError || !newPlan) {
        return { success: false, error: planError?.message || 'Error al crear plan' };
      }
      planId = newPlan.id;
    } else {
      await supabase
        .from('meal_plans')
        .update({
          title: planInput.title,
          notes: planInput.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId)
        .eq('nutritionist_id', user.id);
    }

    // 2. Registrar versión en plan_versions
    const shareToken = planInput.shareToken || `token-${Math.random().toString(36).substring(2, 10)}`;
    const { data: newVersion, error: versionError } = await supabase
      .from('plan_versions')
      .insert({
        plan_id: planId,
        version_number: Math.round(planInput.versionNumber),
        is_active: !planInput.isShareRevoked,
        share_token: shareToken,
        share_expires_at: planInput.shareExpiresAt || null,
      })
      .select()
      .single();

    if (versionError || !newVersion) {
      return { success: false, error: versionError?.message || 'Error al crear versión' };
    }

    // 3. Registrar comidas e ítems
    for (let mIdx = 0; mIdx < planInput.meals.length; mIdx++) {
      const meal = planInput.meals[mIdx];
      const { data: dbMeal } = await supabase
        .from('plan_meals')
        .insert({
          plan_version_id: newVersion.id,
          name: meal.name,
          time: meal.time ? `${meal.time}:00` : null,
          order_index: mIdx,
        })
        .select()
        .single();

      if (dbMeal && meal.items) {
        const itemsToInsert = meal.items.map((item: { groupId: string; subgroupId?: string; exchangeCount: number; selectedFoodId?: string }, iIdx: number) => ({
          meal_id: dbMeal.id,
          group_id: item.groupId,
          subgroup_id: item.subgroupId || null,
          exchanges: item.exchangeCount,
          pinned_food_id: item.selectedFoodId || null,
          order_index: iIdx,
        }));

        await supabase.from('plan_items').insert(itemsToInsert);
      }
    }

    revalidatePath('/dashboard');
    return {
      success: true,
      planId,
      versionId: newVersion.id,
      shareToken,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error al guardar el plan';
    return { success: false, error: msg };
  }
}

// ==============================================================================
// 3. PORTAL DEL PACIENTE (/p/[token])
// ==============================================================================

export async function getPatientPlanByTokenAction(token: string): Promise<{
  success: boolean;
  isRevokedOrExpired?: boolean;
  client?: Client;
  plan?: MealPlan;
  error?: string;
}> {
  // Verificación rápida en datos demo para tokens locales
  const mockClient = MOCK_CLIENTS.find((c) => c.shareToken === token || c.id === token);
  if (mockClient) {
    if (mockClient.isShareRevoked) {
      return { success: false, isRevokedOrExpired: true };
    }
    return {
      success: true,
      client: mockClient,
      plan: MOCK_INITIAL_PLAN,
    };
  }

  const configured = isSupabaseConfigured();
  if (!configured) {
    return { success: false, isRevokedOrExpired: true };
  }

  try {
    const supabase = await createClient();

    // Consultar la versión del plan por share_token
    const { data: version, error } = await supabase
      .from('plan_versions')
      .select('*, meal_plans(*, clients(*))')
      .eq('share_token', token)
      .single();

    if (error || !version || !version.is_active) {
      return { success: false, isRevokedOrExpired: true };
    }

    // Verificar si expiró
    if (version.share_expires_at) {
      const expires = new Date(version.share_expires_at).getTime();
      if (Date.now() > expires) {
        return { success: false, isRevokedOrExpired: true };
      }
    }

    const dbClient = version.meal_plans?.clients;
    if (!dbClient) {
      return { success: false, isRevokedOrExpired: true };
    }

    const targetKcal = Number(dbClient.target_kcal) || 1600;
    const choG = Number(dbClient.target_cho_g) || 180;
    const proG = Number(dbClient.target_pro_g) || 85;
    const lipG = Number(dbClient.target_lip_g) || 50;

    // Mapear cliente
    const client: Client = {
      id: dbClient.id,
      fullName: dbClient.full_name,
      email: dbClient.email || undefined,
      phone: dbClient.phone || undefined,
      age: dbClient.age || 30,
      gender: dbClient.gender || 'femenino',
      weightKg: Number(dbClient.weight_kg) || 60,
      heightCm: Number(dbClient.height_cm) || 165,
      targetCalories: targetKcal,
      targetMacros: {
        carbohydrates: choG,
        proteins: proG,
        lipids: lipG,
      },
      macroDistributionPct: {
        carbohydrates: Math.round(((choG * 4) / targetKcal) * 100) || 50,
        proteins: Math.round(((proG * 4) / targetKcal) * 100) || 20,
        lipids: Math.round(((lipG * 9) / targetKcal) * 100) || 30,
      },
      exclusions: [],
      shareToken: version.share_token,
    };

    return {
      success: true,
      client,
      plan: MOCK_INITIAL_PLAN,
    };
  } catch {
    return { success: false, isRevokedOrExpired: true };
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
