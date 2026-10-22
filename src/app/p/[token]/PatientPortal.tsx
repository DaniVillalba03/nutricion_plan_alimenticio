'use client';

import React, { useState, useMemo } from 'react';
import { MOCK_EXCHANGE_GROUPS, MOCK_FOODS } from '@/lib/mock-data';
import { Client, Food, MealPlan, MealPlanMeal, MealPlanItem, ExchangeGroup } from '@/types/nutrition';
import { formatFriendlyFraction, getFoodEquivalents } from '@/core/exchange-engine';
import { ArrowLeftRight, CheckCircle2, Circle, Search, ShieldAlert } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
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
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3.5">
          <p className="font-display text-xl font-medium tracking-tight">
            NutriPlan<span className="ml-1 align-super font-sans text-[10px] font-semibold tracking-wider text-primary">PY</span>
          </p>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-5 pb-20 pt-10">
        <section>
          <h1 className="text-[40px] font-medium leading-[1.1]">Hola, {firstName(client.fullName)}</h1>
          <p className="mt-3 text-[15px] text-muted">
            Tu plan de hoy: <span className="font-medium text-foreground tabular-nums">{client.targetCalories.toLocaleString('es-PY')} kcal</span>
          </p>
          <p className="mt-1 text-sm tabular-nums text-muted">
            {client.targetMacros.carbohydrates} g carbohidratos · {client.targetMacros.proteins} g proteínas ·{' '}
            {client.targetMacros.lipids} g lípidos
          </p>

          <div className="mt-6">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-foreground">Comidas de hoy</span>
              <span className="tabular-nums text-muted">
                {completedMealsCount} de {totalMealsCount}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
              role="progressbar"
              aria-label="Comidas completadas hoy"
              aria-valuenow={adherencePercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-foreground transition-all duration-300" style={{ width: `${adherencePercent}%` }} />
            </div>
          </div>
        </section>

        <div className="mt-10 space-y-10">
          {patientMeals.map((meal) => (
            <section key={meal.id} aria-label={meal.name}>
              <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-[26px] font-medium leading-tight">{meal.name}</h2>
                  {meal.time && <span className="text-sm tabular-nums text-muted">{meal.time}</span>}
                </div>
                <button
                  type="button"
                  aria-pressed={!!meal.isCompleted}
                  onClick={() => toggleMealCompleted(meal.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
                    meal.isCompleted
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border-strong text-muted hover:bg-surface-muted hover:text-foreground'
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
                    <li key={item.id} className="flex items-center justify-between gap-4 py-4">
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
                        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border-strong px-3.5 text-sm font-medium transition-colors hover:bg-surface-muted active:scale-95"
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

        <p className="mt-14 text-center font-display text-xl font-medium italic leading-snug text-muted">
          Un hábito que fue aprendido puede ser reeducado.
        </p>
        <p className="mt-2 text-center text-[13px] text-subtle">Lic. Laura Molinas · Reg. Prof. 6020</p>
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
