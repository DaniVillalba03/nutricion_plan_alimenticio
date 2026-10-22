'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MOCK_EXCHANGE_GROUPS,
  MOCK_INITIAL_PLAN,
  MOCK_PLAN_TEMPLATES,
} from '@/lib/mock-data';
import { Client, MealPlan, MealPlanItem, ExchangeGroup, PlanTemplate, PlanVersion } from '@/types/nutrition';
import { calculatePlanTotals } from '@/core/exchange-engine';
import { cloneDeep, newId } from '@/lib/utils';
import { MEAL_TYPES } from '@/core/plan-operations';
import { emptyPlanFor } from '@/core/stored-plan';
import { isDemoAccessEnabled } from '@/lib/supabase/client';
import { getPlanAdherenceAction, savePlanAction, updateShareSettingsAction } from '@/actions/plans';
import { usePatients } from '@/components/patients/PatientsProvider';
import { useCatalog } from '@/components/catalog/CatalogProvider';
import { redirectIfSessionExpired } from '@/lib/session';
import { usePlanAutosave, type SaveStatus } from '@/components/planner/usePlanAutosave';
import { PatientSwitcher } from '@/components/patients/PatientSwitcher';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { MacroSummaryBar, MacroMiniBar } from '@/components/planner/MacroSummaryBar';
import { MealCard } from '@/components/planner/MealCard';
import { EquivalentsModal } from '@/components/planner/EquivalentsModal';
import { PlanPdfView } from '@/components/planner/PlanPdfView';
import { SharePlanModal } from '@/components/planner/SharePlanModal';
import {
  SaveTemplateModal,
  NewVersionModal,
  DuplicatePlanModal,
  VersionHistoryModal,
} from '@/components/planner/PlanModals';
import { usePlanEditor } from '@/components/planner/usePlanEditor';
import { Button, Card, Eyebrow, buttonClasses, useToast } from '@/components/ui';
import { Popover, MenuItem } from '@/components/ui/Popover';
import {
  Plus,
  RotateCcw,
  Printer,
  Share2,
  Bookmark,
  Copy,
  History,
  Save,
  ChevronDown,
  MoreHorizontal,
  Users,
  UserPlus,
} from 'lucide-react';

interface ActiveModalState {
  isOpen: boolean;
  group?: ExchangeGroup;
  exchangeCount: number;
  mealId?: string;
  itemId?: string;
  selectedFoodId?: string;
}

/** Tarjeta de dato clínico: etiqueta mono, cifra grande y unidad pequeña. */
function RecordCell({
  label,
  value,
  unit,
  hint,
  dot,
  featured,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  dot?: string;
  /** Ancla visual: tarjeta teñida de verde suave. */
  featured?: boolean;
}) {
  return (
    <div className={`rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-card ${featured ? 'border-primary/30 bg-primary-soft' : ''}`}>
      <dt className="mono-label flex items-center gap-1.5 text-subtle">
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-2 flex items-baseline gap-1.5 tabular-nums">
        <span className={`text-[30px] font-bold leading-none tracking-[-0.04em] ${featured ? 'text-primary-soft-foreground' : 'text-foreground'}`}>{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
        {hint && <span className="mono-label ml-auto text-subtle">{hint}</span>}
      </dd>
    </div>
  );
}

type ToolModal = 'pdf' | 'share' | 'saveTemplate' | 'newVersion' | 'history' | 'duplicate' | 'newPatient' | null;

/** Plan de inicio: el de demostración solo para su paciente de ejemplo; para el resto, vacío. */
function initialPlanFor(client: Client): MealPlan {
  if (isDemoAccessEnabled() && client.id === MOCK_INITIAL_PLAN.clientId) return MOCK_INITIAL_PLAN;
  return emptyPlanFor(client.id, client.fullName, newId('plan-draft'));
}

/** Estado del guardado del plan, siempre visible junto a la versión. */
function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="text-danger underline decoration-danger/40 underline-offset-4 hover:decoration-danger"
      >
        No se pudo guardar · Reintentar
      </button>
    );
  }
  const label = { saved: 'Guardado', saving: 'Guardando…', dirty: 'Cambios sin guardar' }[status];
  return (
    <span role="status" className={status === 'dirty' ? 'text-warning' : undefined}>
      {label}
    </span>
  );
}

/** Se monta con `key={paciente.id}`: al cambiar de paciente el constructor arranca de cero. */
function PlannerWorkspace({ activeClient }: { activeClient: Client }) {
  const { clients, selectClient, updateClient, createClient, getCachedPlan, fetchPlan, cachePlan } = usePatients();
  const { foods } = useCatalog();
  const { toast } = useToast();

  // El plan guardado ya suele estar en caché (lo trajo el servidor con la pantalla): se muestra
  // al instante y se revalida en segundo plano. Sin caché se muestra un esqueleto.
  const cached = getCachedPlan(activeClient.id);
  const [initialPlan] = useState<MealPlan>(() => cached ?? initialPlanFor(activeClient));
  const editor = usePlanEditor(initialPlan);
  const { plan, loadPlan } = editor;
  const [planLoading, setPlanLoading] = useState(cached === undefined);

  // El plan traído en segundo plano solo reemplaza al que se ve si la usuaria aún no lo tocó
  const baselineRef = useRef<MealPlan>(initialPlan);
  const planRef = useRef<MealPlan>(plan);
  useEffect(() => {
    planRef.current = plan;
  });

  // Guardado: el plan se guarda solo tras una pausa sin cambios, al salir de la pantalla y a mano.
  // Mientras llega el plan guardado del paciente no se guarda nada (pisaría el real).
  const lastSaveError = useRef<string | null>(null);
  const persistPlan = async (toSave: MealPlan): Promise<boolean> => {
    try {
      const res = await savePlanAction({
        // Solo se actualiza el plan si pertenece a este paciente; si no, se crea uno nuevo
        id: toSave.clientId === activeClient.id ? toSave.id : undefined,
        clientId: activeClient.id,
        title: toSave.title,
        notes: toSave.notes,
        versionNumber: toSave.versionNumber || 1,
        meals: toSave.meals,
        shareExpiresAt: toSave.shareExpiresAt ?? null,
        isShareRevoked: toSave.isShareRevoked,
      });
      if (!res.success) {
        lastSaveError.current = res.error ?? null;
        redirectIfSessionExpired(res.error);
        return false;
      }
      if ('planId' in res && res.planId && res.shareToken) {
        // Supabase asignó el id real y el token seguro del enlace del paciente
        editor.setPersisted(res.planId, res.shareToken, activeClient.id);
        cachePlan(activeClient.id, { ...toSave, id: res.planId, shareToken: res.shareToken, clientId: activeClient.id });
      }
      lastSaveError.current = null;
      return true;
    } catch {
      lastSaveError.current = 'revisa tu conexión';
      return false;
    }
  };
  const autosave = usePlanAutosave({ plan, save: persistPlan, enabled: !planLoading });
  const { markSaved } = autosave;

  // Lo que el paciente completó hoy desde su portal (lo lee la base de datos, no el dispositivo)
  const [adherence, setAdherence] = useState<{ completed: number; total: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPlanAdherenceAction(plan.id)
      .then((res) => {
        if (!cancelled) setAdherence(res.adherence ?? null);
      })
      .catch(() => {
        // Sin conexión: simplemente no se muestra
      });
    return () => {
      cancelled = true;
    };
  }, [plan.id]);

  useEffect(() => {
    let cancelled = false;
    fetchPlan(activeClient.id)
      .then((fetched) => {
        if (cancelled || !fetched) return;
        if (planRef.current === baselineRef.current) {
          baselineRef.current = fetched;
          loadPlan(fetched);
          markSaved(fetched);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) toast(`No se pudo cargar el plan guardado: ${err instanceof Error ? err.message : 'error'}`);
      })
      .finally(() => {
        if (!cancelled) setPlanLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeClient.id, fetchPlan, loadPlan, toast, markSaved]);

  const [templates, setTemplates] = useState<PlanTemplate[]>(MOCK_PLAN_TEMPLATES);
  const [toolModal, setToolModal] = useState<ToolModal>(null);
  const [equivalents, setEquivalents] = useState<ActiveModalState>({ isOpen: false, exchangeCount: 1.0 });

  const closeTool = () => setToolModal(null);

  // Totales en vivo calculados con el motor puro desacoplado
  const planTotals = useMemo(
    () => calculatePlanTotals(plan, MOCK_EXCHANGE_GROUPS, activeClient),
    [plan, activeClient]
  );

  const currentVersion = plan.versionNumber || 1.0;

  const handleOpenEquivalents = (item: MealPlanItem, group: ExchangeGroup, mealId: string) => {
    setEquivalents({
      isOpen: true,
      group,
      exchangeCount: item.exchangeCount,
      mealId,
      itemId: item.id,
      selectedFoodId: item.selectedFoodId,
    });
  };

  const handleSelectSuggestedFood = (foodId: string) => {
    if (!equivalents.mealId || !equivalents.itemId) return;
    editor.setSuggestedFood(equivalents.mealId, equivalents.itemId, foodId);
    const foodName = foods.find((f) => f.id === foodId)?.name || 'Alimento';
    toast(`Se fijó "${foodName}" como sugerencia`);
  };

  const handleLoadTemplate = (template: PlanTemplate) => {
    editor.loadTemplate(template);
    toast(`Plantilla "${template.name}" cargada correctamente`);
  };

  const handleSaveAsTemplate = (name: string) => {
    const newTemplate: PlanTemplate = {
      id: newId('template-custom'),
      name,
      description: `Plantilla creada desde el plan de ${activeClient.fullName}`,
      targetKcal: Math.round(planTotals.calories.current),
      macroDistribution: {
        carbohydrates: Math.round(planTotals.carbohydrates.distributionPct),
        proteins: Math.round(planTotals.proteins.distributionPct),
        lipids: Math.round(planTotals.lipids.distributionPct),
      },
      meals: cloneDeep(plan.meals),
    };
    setTemplates((prev) => [newTemplate, ...prev]);
    closeTool();
    toast(`Plantilla "${name}" guardada en la biblioteca`);
  };

  /** Guarda una copia del plan para el otro paciente y cambia a su constructor, donde se carga. */
  const handleDuplicatePlan = async (targetClientId: string) => {
    const target = clients.find((c) => c.id === targetClientId);
    if (!target) return;
    closeTool();

    if (target.id === activeClient.id) {
      toast('Elige un paciente distinto al actual');
      return;
    }

    try {
      const res = await savePlanAction({
        clientId: target.id,
        title: `Plan para ${target.fullName} (Copia)`,
        versionNumber: 1,
        meals: cloneDeep(plan.meals),
      });
      if (!res.success) {
        toast(`No se pudo duplicar el plan: ${res.error}`);
        return;
      }
      selectClient(target.id);
      toast(
        isDemoAccessEnabled()
          ? `Plan copiado a ${target.fullName} (en modo demostración las copias no se conservan)`
          : `Plan duplicado con éxito para ${target.fullName}`
      );
    } catch {
      toast('No se pudo duplicar el plan. Revisa tu conexión.');
    }
  };

  const handleSaveNewVersion = (note: string) => {
    const next = editor.saveNewVersion(note);
    closeTool();
    toast(`Se guardó la Versión ${next} y se archivó la ${currentVersion} en el historial`, 4000);
  };

  const handleRestoreVersion = (version: PlanVersion) => {
    editor.restoreVersion(version);
    closeTool();
    toast(`Versión ${version.versionNumber} restaurada al constructor`);
  };

  const handleSavePlan = async () => {
    const ok = await autosave.flush();
    toast(
      ok
        ? isDemoAccessEnabled()
          ? 'Plan guardado en modo local/demostración'
          : 'Plan guardado correctamente'
        : `No se pudo guardar: ${lastSaveError.current ?? 'revisa tu conexión'}`
    );
  };

  const handleUpdateShareSettings = async (isRevoked: boolean, expiresAt: string | null) => {
    editor.updateShareSettings(isRevoked, expiresAt);
    updateClient(activeClient.id, { isShareRevoked: isRevoked, shareExpiresAt: expiresAt || undefined });
    let persisted = true;
    try {
      const res = await updateShareSettingsAction(plan.clientId === activeClient.id ? plan.id : '', isRevoked, expiresAt);
      persisted = res.success;
      if (!res.success) redirectIfSessionExpired(res.error);
    } catch {
      persisted = false;
    }
    toast(
      !persisted
        ? 'No se pudo actualizar el enlace en el servidor. Reintenta.'
        : isRevoked
          ? 'Enlace al portal del paciente REVOCADO'
          : 'Configuración de acceso compartible actualizada'
    );
  };

  const restrictions = activeClient.exclusions;

  return (
    <div>
      <header>
        <Eyebrow className="mb-3">Constructor de planes</Eyebrow>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <PatientSwitcher
              clients={clients}
              activeClient={activeClient}
              onSelect={selectClient}
              onCreate={() => setToolModal('newPatient')}
            />
            {(restrictions.length > 0 || activeClient.isShareRevoked) && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {restrictions.map((r) => (
                  <span
                    key={r}
                    className="mono-label inline-flex items-center rounded-full bg-danger-soft px-2.5 py-1 text-danger-soft-foreground"
                  >
                    Sin {r.toLowerCase()}
                  </span>
                ))}
                {activeClient.isShareRevoked && (
                  <span className="mono-label inline-flex items-center rounded-full border border-border-strong px-2.5 py-1 text-muted">
                    Enlace revocado
                  </span>
                )}
              </div>
            )}
            {activeClient.notes && <p className="mt-3 max-w-2xl text-sm text-muted">{activeClient.notes}</p>}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:flex-nowrap">
            <Popover
              triggerClassName={buttonClasses('secondary', 'md')}
              trigger={
                <>
                  Plantillas
                  <ChevronDown className="h-4 w-4 text-subtle" />
                </>
              }
              panelClassName="w-80"
            >
              {(close) => (
                <>
                  <p className="px-2.5 py-1.5 text-[13px] font-medium text-muted">Plantillas clínicas</p>
                  <div className="max-h-64 overflow-y-auto">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          handleLoadTemplate(tpl);
                          close();
                        }}
                        className="w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-muted"
                      >
                        <span className="block text-sm font-medium text-foreground">{tpl.name}</span>
                        <span className="line-clamp-1 block text-[13px] text-muted">
                          {tpl.targetKcal} kcal · {tpl.description}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 border-t border-border pt-1">
                    <MenuItem
                      icon={<Bookmark className="h-4 w-4" />}
                      onClick={() => {
                        close();
                        setToolModal('saveTemplate');
                      }}
                    >
                      Guardar plan actual como plantilla
                    </MenuItem>
                  </div>
                </>
              )}
            </Popover>

            <Button onClick={() => setToolModal('pdf')}>
              <Printer className="h-4 w-4" />
              PDF
            </Button>
            <Button variant="primary" className="order-first w-full sm:order-none sm:w-auto" onClick={() => setToolModal('share')}>
              <Share2 className="h-4 w-4" />
              Compartir
            </Button>

            <Popover
              triggerLabel="Más acciones"
              triggerClassName="inline-flex h-10 w-10 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              trigger={<MoreHorizontal className="h-5 w-5" />}
            >
              {(close) => (
                <>
                  <MenuItem
                    icon={<Save className="h-4 w-4" />}
                    onClick={() => {
                      close();
                      void handleSavePlan();
                    }}
                  >
                    Guardar plan
                  </MenuItem>
                  <MenuItem
                    icon={<History className="h-4 w-4" />}
                    onClick={() => {
                      close();
                      setToolModal('newVersion');
                    }}
                  >
                    Guardar nueva versión
                  </MenuItem>
                  <MenuItem
                    icon={<Copy className="h-4 w-4" />}
                    onClick={() => {
                      close();
                      setToolModal('duplicate');
                    }}
                  >
                    Duplicar a otro paciente
                  </MenuItem>
                  <MenuItem
                    icon={<RotateCcw className="h-4 w-4" />}
                    onClick={() => {
                      close();
                      editor.reset();
                      toast('Plan reiniciado');
                    }}
                  >
                    Reiniciar plan
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
        </div>


        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <RecordCell label="Edad" value={`${activeClient.age}`} unit="años" />
          <RecordCell featured label="Meta" value={activeClient.targetCalories.toLocaleString('es-PY')} unit="kcal" />
          <RecordCell
            label="Carbohidratos"
            dot="bg-macro-cho"
            value={`${activeClient.targetMacros.carbohydrates}`}
            unit="g"
            hint={`${activeClient.macroDistributionPct.carbohydrates}%`}
          />
          <RecordCell
            label="Proteínas"
            dot="bg-macro-pro"
            value={`${activeClient.targetMacros.proteins}`}
            unit="g"
            hint={`${activeClient.macroDistributionPct.proteins}%`}
          />
          <div className="col-span-2 sm:col-span-1">
            <RecordCell
              label="Lípidos"
              dot="bg-macro-lip"
              value={`${activeClient.targetMacros.lipids}`}
              unit="g"
              hint={`${activeClient.macroDistributionPct.lipids}%`}
            />
          </div>
        </dl>

        <p className="mono-label mt-4 flex items-center gap-3 text-subtle">
          <span>Plan v{currentVersion.toFixed(1)}</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            onClick={() => setToolModal('history')}
            className="underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
          >
            Ver historial
          </button>
          <span aria-hidden="true">·</span>
          <SaveIndicator status={autosave.status} onRetry={() => void handleSavePlan()} />
          {adherence && adherence.total > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Hoy el paciente completó {adherence.completed} de {adherence.total} comidas
              </span>
            </>
          )}
        </p>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <section aria-label="Comidas del plan" className="min-w-0 lg:order-first">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-[28px] font-bold text-foreground">Comidas del día</h2>
            <Popover
              panelClassName="w-60"
              triggerClassName={buttonClasses('secondary', 'sm')}
              trigger={
                <>
                  <Plus className="h-4 w-4" />
                  Añadir comida
                </>
              }
            >
              {(close) => (
                <>
                  {MEAL_TYPES.map((type) => (
                    <MenuItem
                      key={type.name}
                      onClick={() => {
                        close();
                        editor.addMeals([type]);
                      }}
                    >
                      {type.name}
                      <span className="ml-auto text-[13px] tabular-nums text-muted">{type.time}</span>
                    </MenuItem>
                  ))}
                </>
              )}
            </Popover>
          </div>

          {plan.meals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong px-6 py-14 text-center">
              {planLoading ? (
                <div className="mx-auto max-w-sm space-y-3" aria-busy="true" aria-label="Cargando plan">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-surface-muted" />
                  <div className="h-14 animate-pulse rounded-lg bg-surface-muted" />
                  <div className="h-14 animate-pulse rounded-lg bg-surface-muted" />
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold tracking-[-0.035em] text-foreground">Este plan está vacío</p>
                  <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-muted">
                    Empieza con la estructura básica del día o añade las comidas una por una.
                  </p>
                  <Button
                    variant="primary"
                    className="mt-5"
                    onClick={() =>
                      editor.addMeals(
                        MEAL_TYPES.filter((t) => ['Desayuno', 'Almuerzo', 'Merienda', 'Cena'].includes(t.name))
                      )
                    }
                  >
                    Crear estructura básica
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {plan.meals.map((meal, mealIndex) => (
                <MealCard
                  key={meal.id}
                  index={mealIndex}
                  meal={meal}
                  exchangeGroups={MOCK_EXCHANGE_GROUPS}
                  allFoods={foods}
                  onUpdateItem={editor.updateItem}
                  onRemoveItem={editor.removeItem}
                  onAddItem={editor.addItem}
                  onOpenEquivalents={(item, group) => handleOpenEquivalents(item, group, meal.id)}
                  onClearSuggestedFood={(mealId, itemId) => editor.setSuggestedFood(mealId, itemId, undefined)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="lg:order-last lg:self-start lg:sticky lg:top-10">
          <MacroSummaryBar totals={planTotals} client={activeClient} />
        </aside>
      </div>

      <MacroMiniBar totals={planTotals} client={activeClient} />

      {/* Modales */}
      <EquivalentsModal
        isOpen={equivalents.isOpen}
        onClose={() => setEquivalents((prev) => ({ ...prev, isOpen: false }))}
        group={equivalents.group}
        exchangeCount={equivalents.exchangeCount}
        client={activeClient}
        allFoods={foods}
        selectedFoodId={equivalents.selectedFoodId}
        onSelectFood={handleSelectSuggestedFood}
      />

      <PlanPdfView
        isOpen={toolModal === 'pdf'}
        onClose={closeTool}
        plan={plan}
        client={activeClient}
        exchangeGroups={MOCK_EXCHANGE_GROUPS}
        allFoods={foods}
      />

      <SharePlanModal
        isOpen={toolModal === 'share'}
        onClose={closeTool}
        client={activeClient}
        plan={plan}
        onUpdateShareSettings={handleUpdateShareSettings}
      />

      <SaveTemplateModal open={toolModal === 'saveTemplate'} onClose={closeTool} onSave={handleSaveAsTemplate} />

      <NewVersionModal
        open={toolModal === 'newVersion'}
        onClose={closeTool}
        nextVersion={Number((currentVersion + 1.0).toFixed(1))}
        onSave={handleSaveNewVersion}
      />

      <DuplicatePlanModal
        open={toolModal === 'duplicate'}
        onClose={closeTool}
        clients={clients}
        currentClientId={activeClient.id}
        onDuplicate={handleDuplicatePlan}
      />

      <VersionHistoryModal
        open={toolModal === 'history'}
        onClose={closeTool}
        plan={plan}
        currentKcal={planTotals.calories.current}
        onRestore={handleRestoreVersion}
      />

      <NewPatientModal
        open={toolModal === 'newPatient'}
        onClose={closeTool}
        onCreate={async (client, input) => {
          closeTool();
          const result = await createClient(client, input);
          toast(result.ok ? `Paciente "${client.fullName}" creado` : `No se pudo crear el paciente: ${result.error}`);
        }}
      />
    </div>
  );
}

export default function MealPlannerPage() {
  const { activeClient, loading, createClient } = usePatients();
  const { toast } = useToast();
  const [isNewOpen, setIsNewOpen] = useState(false);

  if (!activeClient) {
    return (
      <>
        <Card className="mx-auto mt-10 flex max-w-lg flex-col items-center gap-3 px-6 py-14 text-center">
          <Users className="h-8 w-8 text-subtle" />
          {loading ? (
            <p className="text-sm text-muted">Cargando pacientes…</p>
          ) : (
            <>
              <div>
                <p className="font-semibold text-foreground">Aún no tienes pacientes</p>
                <p className="text-sm text-muted">Crea el primero para empezar a armar su plan de intercambios.</p>
              </div>
              <Button variant="primary" onClick={() => setIsNewOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Nuevo paciente
              </Button>
            </>
          )}
        </Card>
        <NewPatientModal
          open={isNewOpen}
          onClose={() => setIsNewOpen(false)}
          onCreate={async (client, input) => {
            setIsNewOpen(false);
            const result = await createClient(client, input);
            toast(result.ok ? `Paciente "${client.fullName}" creado` : `No se pudo crear el paciente: ${result.error}`);
          }}
        />
      </>
    );
  }

  return <PlannerWorkspace key={activeClient.id} activeClient={activeClient} />;
}
