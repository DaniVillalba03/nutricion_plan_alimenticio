'use client';

import React, { useState, useMemo } from 'react';
import { MOCK_EXCHANGE_GROUPS, MOCK_FOODS } from '@/lib/mock-data';
import { Client, Food, MealPlan, MealPlanMeal, MealPlanItem, ExchangeGroup } from '@/types/nutrition';
import { formatFriendlyFraction, getFoodEquivalents } from '@/core/exchange-engine';
import { Apple, Clock, ArrowLeftRight, CheckCircle2, Circle, Search, ShieldAlert } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Badge, Button, Card, Modal, ToastProvider, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ChangeModalState {
  isOpen: boolean;
  mealId: string;
  itemId: string;
  groupId: string;
  exchangeCount: number;
  currentFoodId?: string;
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
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Apple className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight">NutriPlan PY</span>
              <p className="text-xs font-medium text-primary">Lic. Laura Molinas · Reg. 6020</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Badge tone="primary">Mi plan activo</Badge>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 space-y-5 px-4 py-5 pb-16">
        <div className="space-y-4 rounded-3xl bg-gradient-to-tr from-emerald-800 to-teal-900 p-5 text-white shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-200">Plan personalizado</p>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight">
                ¡Hola, {client.fullName.split(' ')[1] || client.fullName}!
              </h1>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-1 text-xs font-semibold">
              {client.targetCalories} kcal
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[
              ['Carbohidratos', client.targetMacros.carbohydrates],
              ['Proteínas', client.targetMacros.proteins],
              ['Lípidos', client.targetMacros.lipids],
            ].map(([label, grams]) => (
              <div key={label} className="rounded-xl bg-white/10 p-2">
                <span className="block text-xs text-emerald-200">{label}</span>
                <strong className="text-sm font-bold">{grams}g</strong>
              </div>
            ))}
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-100">
              <span>Adherencia de hoy</span>
              <span>
                {completedMealsCount} de {totalMealsCount} comidas ({adherencePercent}%)
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-white/20"
              role="progressbar"
              aria-label="Adherencia de hoy"
              aria-valuenow={adherencePercent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${adherencePercent}%` }} />
            </div>
          </div>
        </div>

        <div className="space-y-0.5 rounded-2xl bg-primary-soft p-3 text-center">
          <p className="text-xs font-bold uppercase italic text-primary-soft-foreground">
            &quot;Un hábito que fue aprendido puede ser reeducado&quot;
          </p>
          <p className="text-xs text-primary-soft-foreground/80">
            Toca el botón «Cambiar» en cualquier alimento para elegir un equivalente.
          </p>
        </div>

        <div className="space-y-4">
          {patientMeals.map((meal) => (
            <Card
              key={meal.id}
              className={cn('overflow-hidden transition-colors', meal.isCompleted && 'border-primary/60 ring-1 ring-primary/30')}
            >
              <div className="flex items-center justify-between border-b border-border bg-surface-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold">{meal.name}</h3>
                  {meal.time && (
                    <span className="flex items-center gap-1 text-xs text-muted">
                      <Clock className="h-3 w-3" /> {meal.time}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={meal.isCompleted ? 'primary' : 'secondary'}
                  aria-pressed={!!meal.isCompleted}
                  onClick={() => toggleMealCompleted(meal.id)}
                >
                  {meal.isCompleted ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completada
                    </>
                  ) : (
                    <>
                      <Circle className="h-3.5 w-3.5" /> Marcar lista
                    </>
                  )}
                </Button>
              </div>

              <div className="space-y-3 p-4">
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
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-muted/40 p-3.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span className={cn('rounded-md border px-2 py-0.5 text-xs font-semibold', group.color.badge)}>
                            {group.shortName}
                          </span>
                          <span className="text-xs font-medium text-muted">{formatFriendlyFraction(item.exchangeCount)} int</span>
                        </div>
                        <strong className="block truncate text-sm font-bold">{selectedFood?.name || 'Alimento a elección'}</strong>
                        <div className="mt-0.5 flex items-baseline gap-2">
                          <span className="text-sm font-bold text-primary">
                            {friendlyHouseholdQty} {selectedFood?.householdUnit}
                          </span>
                          <span className="font-mono text-xs text-muted">({calculatedGrams} g)</span>
                        </div>
                      </div>

                      <Button onClick={() => handleOpenChange(meal.id, item)} className="shrink-0 active:scale-95">
                        <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                        Cambiar
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
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
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              aria-label="Buscar equivalente"
              placeholder="Buscar mandioca, chipa, locote, frutas..."
              value={modalSearch}
              onChange={(e) => setModalSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
          </div>

          {allowedEquivalents.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted">
              No hay alimentos permitidos que coincidan con la búsqueda.
            </p>
          ) : (
            <ul className="space-y-2">
              {allowedEquivalents.map((eq) => {
                const isCurrent = eq.food.id === changeModal.currentFoodId;
                return (
                  <li key={eq.food.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectFood(eq.food.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-left transition-colors',
                        isCurrent ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/50 hover:bg-surface-muted'
                      )}
                    >
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <strong className="truncate text-sm font-semibold">{eq.food.name}</strong>
                          {eq.food.state !== 'no_aplica' && <Badge className="uppercase">{eq.food.state}</Badge>}
                        </span>
                        <span className="mt-0.5 block text-sm font-bold text-primary">{eq.formattedHousehold}</span>
                      </span>
                      {isCurrent ? (
                        <Badge tone="primary" className="shrink-0">Actual ✓</Badge>
                      ) : (
                        <span className="shrink-0 text-xs font-semibold text-primary">Elegir</span>
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md space-y-4 p-6 text-center shadow-xl sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger-soft-foreground">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Enlace inactivo o revocado</h1>
        <p className="text-sm leading-relaxed text-muted">
          El enlace de acceso para este plan nutricional ha expirado o fue revocado por tu nutricionista. Por favor
          solicita uno nuevo a la Lic. Laura Molinas (Reg. Prof. 6020).
        </p>
      </Card>
    </div>
  );
}
