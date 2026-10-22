'use client';

import React, { useState, useMemo } from 'react';
import { MOCK_EXCHANGE_GROUPS, MOCK_FOODS } from '@/lib/mock-data';
import { Client, Food, MealPlan, MealPlanMeal, MealPlanItem, ExchangeGroup } from '@/types/nutrition';
import { formatFriendlyFraction, getFoodEquivalents } from '@/core/exchange-engine';
import { ArrowLeftRight, CheckCircle2, Circle, Search, ShieldAlert, Utensils } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Brand } from '@/components/layout/Brand';
import { Modal, ToastProvider, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ChangeModalState {
  isOpen: boolean;
  mealId: string;
  itemId: string;
  groupId: string;
  exchangeCount: number;
  currentFoodId?: string;
}

/** Primer nombre, sin tratamientos como "Lic." o "Ing.". */
function firstName(fullName: string): string {
  const withoutTitle = fullName.trim().replace(/^(lic|licda|ing|dr|dra|sr|sra)\.?\s+/i, '');
  return withoutTitle.split(/\s+/)[0] || fullName;
}

function PatientPortalContent({ client, plan }: { client: Client; plan: MealPlan }) {
  const { toast } = useToast();

  const [patientMeals, setPatientMeals] = useState<MealPlanMeal[]>(() =>
    plan.meals.map((m) => ({ ...m, isCompleted: false }))
  );

  const [changeModal, setChangeModal] = useState<ChangeModalState>({
    isOpen: false,
    mealId: '',
    itemId: '',
    groupId: '',
    exchangeCount: 1.0,
  });
  const [modalSearch, setModalSearch] = useState('');

  const groupsMap = useMemo(() => new Map<string, ExchangeGroup>(MOCK_EXCHANGE_GROUPS.map((g) => [g.id, g])), []);
  const foodsMap = useMemo(() => new Map<string, Food>(MOCK_FOODS.map((f) => [f.id, f])), []);

  const totalMealsCount = patientMeals.length;
  const completedMealsCount = patientMeals.filter((m) => m.isCompleted).length;
  const adherencePercent = Math.round((completedMealsCount / (totalMealsCount || 1)) * 100);

  const toggleMealCompleted = (mealId: string) => {
    const meal = patientMeals.find((m) => m.id === mealId);
    if (!meal) return;
    if (!meal.isCompleted) toast(`¡Excelente! Marcaste "${meal.name}" como completada.`);
    setPatientMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, isCompleted: !m.isCompleted } : m)));
  };

  const handleOpenChange = (mealId: string, item: MealPlanItem) => {
    setChangeModal({
      isOpen: true,
      mealId,
      itemId: item.id,
      groupId: item.groupId,
      exchangeCount: item.exchangeCount,
      currentFoodId: item.selectedFoodId,
    });
    setModalSearch('');
  };

  const closeChange = () => setChangeModal((prev) => ({ ...prev, isOpen: false }));

  const handleSelectFood = (foodId: string) => {
    setPatientMeals((prev) =>
      prev.map((meal) =>
        meal.id !== changeModal.mealId
          ? meal
          : {
              ...meal,
              items: meal.items.map((item) =>
                item.id !== changeModal.itemId ? item : { ...item, selectedFoodId: foodId }
              ),
            }
      )
    );
    closeChange();
    toast(`Cambiaste tu porción por: "${foodsMap.get(foodId)?.name || 'Alimento'}"`, 3500);
  };

  // Equivalentes permitidos: se ocultan los excluidos por las restricciones del paciente
  const allowedEquivalents = changeModal.isOpen
    ? getFoodEquivalents(changeModal.groupId, changeModal.exchangeCount, MOCK_FOODS, client, modalSearch).filter(
        (eq) => !eq.isExcluded
      )
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
          <Brand size="sm" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-20 pt-8">
        <h1 className="text-[38px] font-medium leading-[1.1]">Hola, {firstName(client.fullName)}</h1>
        <p className="mt-2 text-[15px] text-muted">Este es tu plan de alimentación.</p>

        <section
          aria-label="Tu meta de hoy"
          className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-[0_1px_2px_rgb(15_15_25/0.05)] dark:shadow-none"
        >
          <dl className="grid grid-cols-4 divide-x divide-border">
            <GoalCell label="Calorías" value={client.targetCalories.toLocaleString('es-PY')} unit="kcal" />
            <GoalCell label="Carbo." value={`${client.targetMacros.carbohydrates}`} unit="g" dot="bg-macro-cho" />
            <GoalCell label="Prote." value={`${client.targetMacros.proteins}`} unit="g" dot="bg-macro-pro" />
            <GoalCell label="Lípidos" value={`${client.targetMacros.lipids}`} unit="g" dot="bg-macro-lip" />
          </dl>
          <div className="border-t border-border bg-surface-muted/50 px-4 py-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-foreground">Comidas de hoy</span>
              <span className="tabular-nums text-muted">
                {completedMealsCount} de {totalMealsCount}
              </span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label="Comidas completadas hoy"
              aria-valuenow={adherencePercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${adherencePercent}%` }} />
            </div>
          </div>
        </section>

        <div className="mt-8 space-y-5">
          {patientMeals.map((meal) => (
            <section
              key={meal.id}
              aria-label={meal.name}
              className={cn(
                'overflow-hidden rounded-xl border bg-surface shadow-[0_1px_2px_rgb(15_15_25/0.05)] transition-colors dark:shadow-none',
                meal.isCompleted ? 'border-primary/50' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted"
                    aria-hidden="true"
                  >
                    <Utensils className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h2 className="text-[22px] font-medium leading-tight">{meal.name}</h2>
                    {meal.time && <p className="text-[13px] tabular-nums text-muted">{meal.time}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={!!meal.isCompleted}
                  onClick={() => toggleMealCompleted(meal.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                    meal.isCompleted
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border-strong bg-surface text-muted hover:bg-surface-muted hover:text-foreground'
                  )}
                >
                  {meal.isCompleted ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Hecha
                    </>
                  ) : (
                    <>
                      <Circle className="h-4 w-4" /> Marcar
                    </>
                  )}
                </button>
              </div>

              <ul className={cn('divide-y divide-border', meal.isCompleted && 'opacity-60')}>
                {meal.items.map((item) => {
                  const group = groupsMap.get(item.groupId);
                  if (!group) return null;

                  const selectedFood = item.selectedFoodId
                    ? foodsMap.get(item.selectedFoodId)
                    : MOCK_FOODS.find((f) => f.groupId === group.id);
                  const calculatedGrams = selectedFood ? Math.round(selectedFood.baseGrams * item.exchangeCount) : 0;
                  const friendlyHouseholdQty = selectedFood
                    ? formatFriendlyFraction(Math.round(selectedFood.householdQty * item.exchangeCount * 100) / 100)
                    : '';

                  return (
                    <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-4">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[13px] text-muted">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: group.color.accent }}
                            aria-hidden="true"
                          />
                          {group.shortName} · {formatFriendlyFraction(item.exchangeCount)} int
                        </p>
                        <p className="mt-1 text-lg font-medium leading-snug">{selectedFood?.name || 'Alimento a elección'}</p>
                        <p className="mt-0.5 text-[15px] text-foreground">
                          <span className="font-medium">
                            {friendlyHouseholdQty} {selectedFood?.householdUnit}
                          </span>
                          <span className="ml-1.5 tabular-nums text-muted">({calculatedGrams} g)</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenChange(meal.id, item)}
                        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3.5 text-sm font-medium transition-colors hover:bg-surface-muted active:scale-95"
                      >
                        <ArrowLeftRight className="h-4 w-4 text-muted" />
                        Cambiar
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-dashed border-border-strong px-6 py-6 text-center">
          <p className="font-display text-xl font-medium italic leading-snug text-foreground">
            Un hábito que fue aprendido puede ser reeducado.
          </p>
          <p className="mt-2 text-[13px] text-muted">Lic. Laura Molinas · Reg. Prof. 6020</p>
        </div>
      </main>

      <Modal
        open={changeModal.isOpen}
        onClose={closeChange}
        size="sm"
        title="Elige un equivalente"
        description={`Porción calculada para ${formatFriendlyFraction(changeModal.exchangeCount)} intercambios.`}
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              aria-label="Buscar equivalente"
              placeholder="Buscar mandioca, chipa, locote, frutas…"
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="h-11 w-full rounded-lg border border-border-strong bg-surface pl-10 pr-3 text-[15px] text-foreground placeholder:text-subtle focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/20"
            />
          </div>

          {allowedEquivalents.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              No hay alimentos permitidos que coincidan con la búsqueda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {allowedEquivalents.map((eq) => {
                const isCurrent = eq.food.id === changeModal.currentFoodId;
                return (
                  <li key={eq.food.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectFood(eq.food.id)}
                      className={cn(
                        '-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-surface-muted',
                        isCurrent && 'bg-surface-muted'
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-medium">{eq.food.name}</span>
                        <span className="block text-sm text-muted">{eq.formattedHousehold}</span>
                      </span>
                      {isCurrent ? (
                        <span className="shrink-0 text-[13px] font-medium text-primary">Actual</span>
                      ) : (
                        <span className="shrink-0 text-[13px] text-muted">Elegir</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Modal>
    </div>
  );
}

/** Celda de la tarjeta de metas del día. */
function GoalCell({ label, value, unit, dot }: { label: string; value: string; unit: string; dot?: string }) {
  return (
    <div className="px-2 py-3.5 text-center">
      <dt className="flex items-center justify-center gap-1.5 text-[12px] text-muted">
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-1 tabular-nums">
        <span className="block font-display text-[24px] font-medium leading-none text-foreground">{value}</span>
        <span className="mt-0.5 block text-[12px] text-muted">{unit}</span>
      </dd>
    </div>
  );
}

/** Portal del paciente: recibe el plan ya validado por el servidor. */
export function PatientPortal({ client, plan }: { client: Client; plan: MealPlan }) {
  return (
    <ToastProvider>
      <PatientPortalContent client={client} plan={plan} />
    </ToastProvider>
  );
}

/** Enlace inexistente, vencido o revocado (no se distingue a propósito). */
export function PortalUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-sm text-center">
        <ShieldAlert className="mx-auto h-7 w-7 text-subtle" strokeWidth={1.5} />
        <h1 className="mt-4 text-3xl font-medium text-foreground">Este enlace ya no está disponible</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Venció o fue revocado por tu nutricionista. Pídele uno nuevo a la Lic. Laura Molinas (Reg. Prof. 6020).
        </p>
      </div>
    </div>
  );
}
