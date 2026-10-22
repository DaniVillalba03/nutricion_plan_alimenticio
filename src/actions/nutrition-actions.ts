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
import { randomBytes } from 'node:crypto';
import { mapSharedPlan } from '@/core/shared-plan';

/** Token de acceso del portal: 32 bytes aleatorios (43 caracteres URL-safe). */
function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Los datos y tokens de demostración solo existen sin Supabase o con el acceso demo habilitado. */
function isDemoDataAllowed(): boolean {
  return !isSupabaseConfigured() || process.env.NEXT_PUBLIC_ENABLE_DEMO_ACCESS === 'true';
}

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
    if (!planId || !UUID_RE.test(planId)) {
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
      const { error: updateError } = await supabase
        .from('meal_plans')
        .update({
          title: planInput.title,
          notes: planInput.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId)
        .eq('nutritionist_id', user.id);
      if (updateError) return { success: false, error: updateError.message };
    }

    // 2. Versión del plan. El token lo genera SIEMPRE el servidor (se ignora el del cliente):
    //    es estable por plan, así que el enlace del paciente apunta siempre a la última versión.
    const versionNumber = Math.round(planInput.versionNumber);
    const { data: sameVersion } = await supabase
      .from('plan_versions')
      .select('id, share_token')
      .eq('plan_id', planId)
      .eq('version_number', versionNumber)
      .maybeSingle();

    let versionId: string;
    let shareToken: string;

    if (sameVersion) {
      shareToken = sameVersion.share_token || generateShareToken();
      versionId = sameVersion.id;
      const { error: versionError } = await supabase
        .from('plan_versions')
        .update({
          is_active: !planInput.isShareRevoked,
          share_token: shareToken,
          share_expires_at: planInput.shareExpiresAt || null,
        })
        .eq('id', versionId);
      if (versionError) return { success: false, error: versionError.message };
      await supabase.from('plan_meals').delete().eq('plan_version_id', versionId);
    } else {
      const { data: previous } = await supabase
        .from('plan_versions')
        .select('id, share_token')
        .eq('plan_id', planId)
        .not('share_token', 'is', null)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      shareToken = previous?.share_token || generateShareToken();
      if (previous) {
        // El token pasa a la nueva versión; la anterior queda archivada (UNIQUE en share_token)
        await supabase.from('plan_versions').update({ share_token: null, is_active: false }).eq('id', previous.id);
      }

      const { data: newVersion, error: versionError } = await supabase
        .from('plan_versions')
        .insert({
          plan_id: planId,
          version_number: versionNumber,
          is_active: !planInput.isShareRevoked,
          share_token: shareToken,
          share_expires_at: planInput.shareExpiresAt || null,
        })
        .select()
        .single();

      if (versionError || !newVersion) {
        return { success: false, error: versionError?.message || 'Error al crear versión' };
      }
      versionId = newVersion.id;
    }

    // 3. Registrar comidas e ítems
    for (let mIdx = 0; mIdx < planInput.meals.length; mIdx++) {
      const meal = planInput.meals[mIdx];
      const { data: dbMeal } = await supabase
        .from('plan_meals')
        .insert({
          plan_version_id: versionId,
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
      versionId,
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
  // Datos de demostración: solo sin Supabase o con el acceso demo habilitado expresamente
  if (isDemoDataAllowed()) {
    const mockClient = MOCK_CLIENTS.find((c) => c.shareToken === token || c.id === token);
    if (mockClient) {
      if (mockClient.isShareRevoked) return { success: false, isRevokedOrExpired: true };
      return { success: true, client: mockClient, plan: MOCK_INITIAL_PLAN };
    }
  }

  if (!isSupabaseConfigured() || typeof token !== 'string' || token.length < 32 || token.length > 100) {
    return { success: false, isRevokedOrExpired: true };
  }

  try {
    // Función de Postgres (SECURITY DEFINER): devuelve solo el plan de este token, o null
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('get_shared_plan', { p_token: token });
    if (error || !data) return { success: false, isRevokedOrExpired: true };

    const shared = mapSharedPlan(data, token);
    if (!shared) return { success: false, isRevokedOrExpired: true };
    return { success: true, client: shared.client, plan: shared.plan };
  } catch {
    return { success: false, isRevokedOrExpired: true };
  }
}

/** Revoca o reactiva el enlace del paciente y fija su vencimiento (solo el dueño del plan, por RLS). */
export async function updateShareSettingsAction(
  planId: string,
  isRevoked: boolean,
  expiresAt: string | null
): Promise<{ success: boolean; error?: string }> {
  if (!UUID_RE.test(planId)) {
    // Plan aún no guardado en la base: no hay enlace que actualizar
    return { success: true };
  }
  const user = await getAuthenticatedUser();
  if (user.isDemo) return { success: true };

  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from('plan_versions')
      .update({ is_active: !isRevoked, share_expires_at: expiresAt })
      .eq('plan_id', planId)
      .not('share_token', 'is', null);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error al actualizar el enlace' };
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
