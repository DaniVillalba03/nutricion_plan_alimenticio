'use server';

import { createClient, isSupabaseConfigured } from '@/lib/supabase/server';
import { ClientInputSchema } from '@/core/validators';
import { MOCK_CLIENTS } from '@/lib/mock-data';
import { Client } from '@/types/nutrition';
import { revalidatePath } from 'next/cache';
import { getAuthenticatedUser, isDemoDataAllowed, SESSION_EXPIRED, UUID_RE } from './shared';

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
    if (user.unauthenticated) return { success: false, data: [] };
    const supabase = await createClient();

    const { data: dbClients, error } = await supabase
      .from('clients')
      .select('*, client_food_rules(food_id, group_id, rule_type, reason)')
      .eq('nutritionist_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, data: [] };
    }
    if (!dbClients || dbClients.length === 0) {
      // Sin pacientes reales: los de demostración solo se muestran si el acceso demo está habilitado
      return { success: true, data: isDemoDataAllowed() ? MOCK_CLIENTS : [] };
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
    return { success: false, data: [] };
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
  if (user.unauthenticated) return { success: false, error: SESSION_EXPIRED };
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

/** Actualiza los datos y metas de un paciente existente (y reemplaza sus restricciones). */
export async function updateClientAction(clientId: string, rawInput: unknown): Promise<{ success: boolean; error?: string }> {
  const parseResult = ClientInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return { success: false, error: parseResult.error.issues.map((i) => i.message).join(', ') };
  }
  const data = parseResult.data;

  const user = await getAuthenticatedUser();
  if (user.unauthenticated) return { success: false, error: SESSION_EXPIRED };
  if (!isSupabaseConfigured() || user.isDemo || !UUID_RE.test(clientId)) return { success: true };

  try {
    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from('clients')
      .update({
        full_name: data.fullName,
        email: data.email || null,
        phone: data.phone || null,
        age: data.age,
        gender: data.gender,
        weight_kg: data.weightKg,
        height_cm: data.heightCm || null,
        activity_level: data.activityLevel || null,
        target_kcal: data.targetKcal,
        target_cho_g: data.targetChoG,
        target_pro_g: data.targetProG,
        target_lip_g: data.targetLipG,
        notes: data.notes || null,
      })
      .eq('id', clientId)
      .eq('nutritionist_id', user.id)
      .select('id');

    if (error) return { success: false, error: error.message };
    if (!updated || updated.length === 0) return { success: false, error: 'No se encontró el paciente' };

    // Las restricciones se reemplazan completas (solo las de tipo exclusión por motivo)
    const { error: deleteRulesError } = await supabase
      .from('client_food_rules')
      .delete()
      .eq('client_id', clientId)
      .eq('rule_type', 'exclude');
    if (deleteRulesError) return { success: false, error: deleteRulesError.message };

    if (data.exclusions.length > 0) {
      const { error: rulesError } = await supabase
        .from('client_food_rules')
        .insert(data.exclusions.map((reason) => ({ client_id: clientId, rule_type: 'exclude', reason })));
      if (rulesError) return { success: false, error: rulesError.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado' };
  }
}

/**
 * Elimina un paciente y, en cascada (FK `ON DELETE CASCADE`), sus planes, versiones y reglas.
 * Los enlaces del portal de esos planes dejan de funcionar. La política RLS de `clients`
 * ya limita el borrado a los pacientes de la nutricionista autenticada.
 */
export async function deleteClientAction(clientId: string): Promise<{ success: boolean; error?: string }> {
  if (typeof clientId !== 'string' || clientId.length === 0) {
    return { success: false, error: 'Paciente no válido' };
  }

  const user = await getAuthenticatedUser();
  if (user.unauthenticated) return { success: false, error: SESSION_EXPIRED };
  if (!isSupabaseConfigured() || user.isDemo) {
    // Modo demostración: no hay nada que borrar en la base
    return { success: true };
  }

  // Los pacientes de demostración (ids no UUID) no existen en la base
  if (!UUID_RE.test(clientId)) return { success: true };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('nutritionist_id', user.id)
      .select('id');

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) return { success: false, error: 'No se encontró el paciente' };

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/clients');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Error inesperado' };
  }
}
