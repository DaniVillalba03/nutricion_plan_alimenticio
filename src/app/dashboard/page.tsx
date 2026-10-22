'use client';

import React, { useMemo, useState } from 'react';
import {
  MOCK_EXCHANGE_GROUPS,
  MOCK_FOODS,
  MOCK_INITIAL_PLAN,
  MOCK_PLAN_TEMPLATES,
} from '@/lib/mock-data';
import { MealPlanItem, ExchangeGroup, PlanTemplate, PlanVersion } from '@/types/nutrition';
import { calculatePlanTotals } from '@/core/exchange-engine';
import { cloneDeep, newId } from '@/lib/utils';
import { isDemoAccessEnabled } from '@/lib/supabase/client';
import { savePlanAction, updateShareSettingsAction } from '@/actions/nutrition-actions';
import { usePatients } from '@/components/patients/PatientsProvider';
import { PatientSwitcher } from '@/components/patients/PatientSwitcher';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { MacroSummaryBar } from '@/components/planner/MacroSummaryBar';
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
import { Button, Badge, Card, useToast } from '@/components/ui';
import { Popover, MenuItem } from '@/components/ui/Popover';
import {
  Utensils,
  Plus,
  RotateCcw,
  Printer,
  Share2,
  Bookmark,
  Copy,
  History,
  Layers,
  Save,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';

interface ActiveModalState {
  isOpen: boolean;
  group?: ExchangeGroup;
  exchangeCount: number;
  mealId?: string;
  itemId?: string;
  selectedFoodId?: string;
}

type ToolModal = 'pdf' | 'share' | 'saveTemplate' | 'newVersion' | 'history' | 'duplicate' | 'newPatient' | null;

export default function MealPlannerPage() {
  const { clients, activeClient, selectClient, updateClient, createClient } = usePatients();
  const { toast } = useToast();
  const editor = usePlanEditor(MOCK_INITIAL_PLAN);
  const { plan } = editor;

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
    const foodName = MOCK_FOODS.find((f) => f.id === foodId)?.name || 'Alimento';
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

  const handleDuplicatePlan = (targetClientId: string) => {
    const target = clients.find((c) => c.id === targetClientId);
    if (!target) return;
    selectClient(target.id);
    editor.assignToClient(
      target.id,
      `Plan para ${target.fullName} (Copia)`,
      isDemoAccessEnabled() ? target.shareToken : undefined
    );
    closeTool();
    toast(`Plan duplicado con éxito para ${target.fullName}`);
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
    try {
      const res = await savePlanAction({
        // Solo se actualiza el plan si pertenece a este paciente; si no, se crea uno nuevo
        id: plan.clientId === activeClient.id ? plan.id : undefined,
        clientId: activeClient.id,
        title: plan.title,
        notes: plan.notes,
        versionNumber: currentVersion,
        meals: plan.meals,
        shareExpiresAt: plan.shareExpiresAt ?? null,
        isShareRevoked: plan.isShareRevoked,
      });
      if (res.success && 'planId' in res && res.planId && res.shareToken) {
        // Supabase asignó el id real y el token seguro del enlace del paciente
        editor.setPersisted(res.planId, res.shareToken, activeClient.id);
      }
      toast(res.success ? ('message' in res && res.message ? res.message : 'Plan guardado correctamente') : `No se pudo guardar: ${res.error}`);
    } catch {
      toast('No se pudo guardar el plan. Revisa tu conexión.');
    }
  };

  const handleUpdateShareSettings = async (isRevoked: boolean, expiresAt: string | null) => {
    editor.updateShareSettings(isRevoked, expiresAt);
    updateClient(activeClient.id, { isShareRevoked: isRevoked, shareExpiresAt: expiresAt || undefined });
    let persisted = true;
    try {
      const res = await updateShareSettingsAction(plan.clientId === activeClient.id ? plan.id : '', isRevoked, expiresAt);
      persisted = res.success;
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

  return (
    <div className="space-y-5 pb-12">
      {/* Encabezado: paciente + acciones */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <PatientSwitcher
              clients={clients}
              activeClient={activeClient}
              onSelect={selectClient}
              onCreate={() => setToolModal('newPatient')}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {activeClient.exclusions.length === 0 ? (
                <span className="text-xs text-muted">Sin restricciones</span>
              ) : (
                activeClient.exclusions.map((exclusion) => (
                  <Badge key={exclusion} tone="danger">
                    Sin {exclusion}
                  </Badge>
                ))
              )}
              {activeClient.isShareRevoked && <Badge tone="danger">Enlace revocado</Badge>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setToolModal('history')}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-info-soft px-3 text-xs font-semibold text-info-soft-foreground transition-colors hover:opacity-80"
              title="Ver historial de versiones"
            >
              <History className="h-3.5 w-3.5" />
              Versión {currentVersion.toFixed(1)}
            </button>

            <Popover
              triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-muted"
              trigger={
                <>
                  <Layers className="h-3.5 w-3.5 text-warning" />
                  Plantillas
                  <ChevronDown className="h-3 w-3 text-subtle" />
                </>
              }
              panelClassName="w-80"
            >
              {(close) => (
                <>
                  <p className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-subtle">
                    Plantillas clínicas
                  </p>
                  <div className="max-h-64 space-y-0.5 overflow-y-auto">
                    {templates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          handleLoadTemplate(tpl);
                          close();
                        }}
                        className="w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-muted"
                      >
                        <span className="block text-sm font-semibold text-foreground">{tpl.name}</span>
                        <span className="line-clamp-1 block text-xs text-muted">
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

            <Button size="sm" onClick={() => setToolModal('pdf')}>
              <Printer className="h-3.5 w-3.5" />
              PDF
            </Button>
            <Button size="sm" variant="primary" onClick={() => setToolModal('share')}>
              <Share2 className="h-3.5 w-3.5" />
              Compartir
            </Button>

            <Popover
              triggerLabel="Más acciones"
              triggerClassName="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              trigger={<MoreHorizontal className="h-4 w-4" />}
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
                      toast('Plan reiniciado a los valores base de demostración');
                    }}
                  >
                    Reiniciar plan
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
        </div>
        {activeClient.notes && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted">{activeClient.notes}</p>
        )}
      </Card>

      {/* Balance nutricional en vivo */}
      <MacroSummaryBar totals={planTotals} client={activeClient} />

      {/* Comidas */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
          <Utensils className="h-4 w-4 text-primary" />
          Comidas del día
          <span className="text-sm font-medium text-muted">({plan.meals.length})</span>
        </h2>
        <Button size="sm" variant="primary" onClick={editor.addMeal}>
          <Plus className="h-3.5 w-3.5" />
          Añadir comida
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {plan.meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            exchangeGroups={MOCK_EXCHANGE_GROUPS}
            allFoods={MOCK_FOODS}
            onUpdateItem={editor.updateItem}
            onRemoveItem={editor.removeItem}
            onAddItem={editor.addItem}
            onOpenEquivalents={(item, group) => handleOpenEquivalents(item, group, meal.id)}
            onClearSuggestedFood={(mealId, itemId) => editor.setSuggestedFood(mealId, itemId, undefined)}
          />
        ))}
      </div>

      {/* Modales */}
      <EquivalentsModal
        isOpen={equivalents.isOpen}
        onClose={() => setEquivalents((prev) => ({ ...prev, isOpen: false }))}
        group={equivalents.group}
        exchangeCount={equivalents.exchangeCount}
        client={activeClient}
        allFoods={MOCK_FOODS}
        selectedFoodId={equivalents.selectedFoodId}
        onSelectFood={handleSelectSuggestedFood}
      />

      <PlanPdfView
        isOpen={toolModal === 'pdf'}
        onClose={closeTool}
        plan={plan}
        client={activeClient}
        exchangeGroups={MOCK_EXCHANGE_GROUPS}
        allFoods={MOCK_FOODS}
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
