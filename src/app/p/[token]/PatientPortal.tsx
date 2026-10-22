'use client';

import React, { useState, useMemo } from 'react';
import { MOCK_EXCHANGE_GROUPS } from '@/lib/mock-data';
import { Client, Food, MealPlan, MealPlanMeal, MealPlanItem, ExchangeGroup } from '@/types/nutrition';
import { formatFriendlyFraction, getFoodEquivalents } from '@/core/exchange-engine';
import { applyProgress, type PortalProgress } from '@/core/portal-progress';
import { setPortalFoodAction, setPortalMealAction } from '@/actions/portal';
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

interface PortalProps {
  client: Client;
  plan: MealPlan;
  /** Token del enlace: identifica el plan al guardar el avance en la base de datos. */
  token: string;
  /** Día de hoy en Paraguay (AAAA-MM-DD), calculado en el servidor. */
  today: string;
  /** Avance ya guardado (comidas completadas hoy y alimentos elegidos). */
  initialProgress: PortalProgress;
  /** Catálogo de alimentos (de la base de datos) para mostrar y ofrecer equivalentes. */
  foods: Food[];
}

function PatientPortalContent({ client, plan, token, today, initialProgress, foods }: PortalProps) {
  const { toast } = useToast();

  // El avance vive en la base de datos: llega con la página y cada cambio se guarda en el servidor
  const [patientMeals, setPatientMeals] = useState<MealPlanMeal[]>(() =>
    applyProgress(
      plan.meals.map((m) => ({ ...m, isCompleted: false })),
      initialProgress
    )
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
  const foodsMap = useMemo(() => new Map<string, Food>(foods.map((f) => [f.id, f])), [foods]);

  const totalMealsCount = patientMeals.length;
  const completedMealsCount = patientMeals.filter((m) => m.isCompleted).length;
  const adherencePercent = Math.round((completedMealsCount / (totalMealsCount || 1)) * 100);

  const setMealCompleted = (mealId: string, completed: boolean) =>
    setPatientMeals((prev) => prev.map((m) => (m.id === mealId ? { ...m, isCompleted: completed } : m)));

  const toggleMealCompleted = async (mealId: string) => {
    const mealIndex = patientMeals.findIndex((m) => m.id === mealId);
    const meal = patientMeals[mealIndex];
    if (!meal) return;

    // Se refleja al instante y se confirma con el servidor; si falla, se deshace y se avisa
    const next = !meal.isCompleted;
    setMealCompleted(mealId, next);
    if (next) toast(`¡Excelente! Marcaste "${meal.name}" como completada.`);
    try {
      const res = await setPortalMealAction(token, today, mealIndex, next);
      if (!res.success) throw new Error(res.error);
    } catch (err) {
      setMealCompleted(mealId, !next);
      toast(err instanceof Error && err.message ? err.message : 'No se pudo guardar. Intenta de nuevo.', 4000);
    }
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

  const handleSelectFood = async (foodId: string) => {
    const mealIndex = patientMeals.findIndex((m) => m.id === changeModal.mealId);
    const itemIndex = patientMeals[mealIndex]?.items.findIndex((i) => i.id === changeModal.itemId) ?? -1;
    const previousFoodId = patientMeals[mealIndex]?.items[itemIndex]?.selectedFoodId;

    const applyFood = (id: string | undefined) =>
      setPatientMeals((prev) =>
        prev.map((meal) =>
          meal.id !== changeModal.mealId
            ? meal
            : { ...meal, items: meal.items.map((item) => (item.id !== changeModal.itemId ? item : { ...item, selectedFoodId: id })) }
        )
      );

    applyFood(foodId);
    closeChange();
    toast(`Cambiaste tu porción por: "${foodsMap.get(foodId)?.name || 'Alimento'}"`, 3500);

    if (mealIndex < 0 || itemIndex < 0) return;
    try {
      const res = await setPortalFoodAction(token, mealIndex, itemIndex, foodId);
      if (!res.success) throw new Error(res.error);
    } catch (err) {
      applyFood(previousFoodId);
      toast(err instanceof Error && err.message ? err.message : 'No se pudo guardar el cambio.', 4000);
    }
  };

  // Equivalentes permitidos: se ocultan los excluidos por las restricciones del paciente
  const allowedEquivalents = changeModal.isOpen
    ? getFoodEquivalents(changeModal.groupId, changeModal.exchangeCount, foods, client, modalSearch).filter(
        (eq) => !eq.isExcluded
      )
    : [];

  return (
    <div className="relative flex min-h-screen flex-col bg-background text-foreground">
      <div className="bg-hero pointer-events-none absolute inset-x-0 top-0 h-[460px]" aria-hidden="true" />
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between px-5 py-3">
          <Brand size="sm" />
          <ThemeToggle />
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-lg flex-1 px-5 pb-20 pt-6">
        <section
          aria-label="Tu plan de hoy"
          className="relative isolate overflow-hidden rounded-[22px] border border-border bg-surface p-6 text-foreground shadow-card"
        >
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              backgroundImage:
                'radial-gradient(70% 80% at 90% 0%, var(--glow), transparent 70%), radial-gradient(60% 60% at 0% 100%, var(--glow-cool), transparent 70%)',
            }}
            aria-hidden="true"
          />
          <p className="mono-label flex items-center gap-2 text-subtle">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            Tu plan de hoy
          </p>
          <h1 className="mt-3 text-[44px]">
            Hola, <span className="text-primary-text">{firstName(client.fullName)}</span>
          </h1>
          <p className="mt-3 text-base text-muted">Elige entre los alimentos equivalentes cuando quieras variar.</p>

          <dl className="mt-6 grid grid-cols-4 gap-2">
            <GoalCell label="Calorías" value={client.targetCalories.toLocaleString('es-PY')} unit="kcal" />
            <GoalCell label="Carbo." value={`${client.targetMacros.carbohydrates}`} unit="g" dot="bg-macro-cho" />
            <GoalCell label="Prote." value={`${client.targetMacros.proteins}`} unit="g" dot="bg-macro-pro" />
            <GoalCell label="Lípidos" value={`${client.targetMacros.lipids}`} unit="g" dot="bg-macro-lip" />
          </dl>

          <div className="mt-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-foreground">Comidas de hoy</span>
              <span className="tabular-nums text-muted">
                {completedMealsCount} de {totalMealsCount}
              </span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
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
                'overflow-hidden rounded-[14px] border bg-surface shadow-card transition-colors',
                meal.isCompleted ? 'border-primary/50' : 'border-border'
              )}
            >
              <div className="flex items-center justify-between gap-3 border-b border-border bg-primary-soft px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    aria-hidden="true"
                  >
                    <Utensils className="h-4 w-4" strokeWidth={1.6} />
                  </span>
                  <div>
                    <h2 className="text-[22px] font-bold leading-tight tracking-[-0.035em]">{meal.name}</h2>
                    {meal.time && <p className="mono-label text-subtle">{meal.time}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  aria-pressed={!!meal.isCompleted}
                  onClick={() => toggleMealCompleted(meal.id)}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors',
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
                    : foods.find((f) => f.groupId === group.id);
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
                        <p className="mt-1 text-lg font-semibold leading-snug tracking-[-0.02em]">{selectedFood?.name || 'Alimento a elección'}</p>
                        <p className="mt-2 flex items-center gap-2">
                          <span className="rounded-full bg-primary-soft px-3 py-1 text-[15px] font-semibold text-primary-soft-foreground">
                            {friendlyHouseholdQty} {selectedFood?.householdUnit}
                          </span>
                          <span className="text-sm tabular-nums text-muted">{calculatedGrams} g</span>
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenChange(meal.id, item)}
                        className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold transition-colors hover:bg-surface-muted active:scale-95"
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

        <div className="mt-12 rounded-[14px] border border-dashed border-border-strong px-6 py-7 text-center">
          <p className="text-xl font-semibold tracking-[-0.03em] leading-snug text-foreground">
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
                        <span className="shrink-0 text-[13px] font-medium text-primary-text">Actual</span>
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
    <div className="rounded-[12px] border border-border bg-surface-muted/60 px-2 py-3.5 text-center">
      <dt className="mono-label flex items-center justify-center gap-1.5 text-subtle">
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-1 tabular-nums">
        <span className="block text-[26px] font-bold tracking-[-0.04em] leading-none text-foreground">{value}</span>
        <span className="mt-0.5 block text-[12px] text-muted">{unit}</span>
      </dd>
    </div>
  );
}

/** Portal del paciente: recibe el plan ya validado por el servidor. */
export function PatientPortal(props: PortalProps) {
  return (
    <ToastProvider>
      <PatientPortalContent {...props} />
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
