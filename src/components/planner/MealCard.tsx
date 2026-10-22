'use client';

import React from 'react';
import { MealPlanMeal, MealPlanItem, ExchangeGroup, Food } from '@/types/nutrition';
import { formatFriendlyFraction } from '@/core/exchange-engine';
import { Plus, Trash2, X } from 'lucide-react';
import { Card } from '@/components/ui';
import { Popover } from '@/components/ui/Popover';
import { ExchangeStepper } from './ExchangeStepper';

const nf = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 });

interface MealCardProps {
  meal: MealPlanMeal;
  exchangeGroups: ExchangeGroup[];
  allFoods: Food[];
  onUpdateItem: (mealId: string, itemId: string, exchangeCount: number) => void;
  onRemoveItem: (mealId: string, itemId: string) => void;
  onAddItem: (mealId: string, groupId: string, exchangeCount: number) => void;
  onOpenEquivalents: (item: MealPlanItem, group: ExchangeGroup) => void;
  onClearSuggestedFood: (mealId: string, itemId: string) => void;
}

/**
 * Una comida del plan: encabezado con totales y una lista de grupos separados por líneas
 * finas (sin cajas dentro de cajas). El alimento sugerido es una segunda línea de texto.
 */
export function MealCard({
  meal,
  exchangeGroups,
  allFoods,
  onUpdateItem,
  onRemoveItem,
  onAddItem,
  onOpenEquivalents,
  onClearSuggestedFood,
}: MealCardProps) {
  const groupsMap = new Map<string, ExchangeGroup>(exchangeGroups.map((g) => [g.id, g]));
  const foodsMap = new Map<string, Food>(allFoods.map((f) => [f.id, f]));

  let mealCalories = 0;
  let mealExchanges = 0;
  for (const item of meal.items) {
    const group = groupsMap.get(item.groupId);
    if (!group) continue;
    mealExchanges += item.exchangeCount;
    mealCalories += group.referenceMacros.calories * item.exchangeCount;
  }

  const groupMenu = (close: () => void) => (
    <div className="max-h-72 overflow-y-auto">
      {exchangeGroups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => {
            onAddItem(meal.id, g.id, 1.0);
            close();
          }}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
        >
          <span className="flex items-center gap-2.5 text-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: g.color.accent }} aria-hidden="true" />
            {g.name}
          </span>
          <span className="text-[13px] tabular-nums text-muted">{g.referenceMacros.calories} kcal</span>
        </button>
      ))}
    </div>
  );

  const addButton = (
    <Popover
      align="right"
      panelClassName="w-72"
      triggerLabel="Añadir grupo a esta comida"
      triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-muted"
      trigger={
        <>
          <Plus className="h-3.5 w-3.5" />
          Añadir grupo
        </>
      }
    >
      {groupMenu}
    </Popover>
  );

  return (
    <Card className="overflow-visible">
      <div className="flex items-baseline justify-between gap-4 px-5 pb-1 pt-5">
        <div className="flex min-w-0 items-baseline gap-3">
          <h3 className="font-display text-[22px] font-medium leading-tight text-foreground">{meal.name}</h3>
          {meal.time && <span className="text-sm tabular-nums text-muted">{meal.time}</span>}
        </div>
        <p className="shrink-0 text-sm tabular-nums text-muted">
          {nf.format(mealExchanges)} int · {nf.format(Math.round(mealCalories))} kcal
        </p>
      </div>

      {meal.items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted">Esta comida todavía no tiene grupos.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border border-t border-border">
          {meal.items.map((item) => {
            const group = groupsMap.get(item.groupId);
            if (!group) return null;

            const itemCalories = Math.round(group.referenceMacros.calories * item.exchangeCount);
            const suggestedFood = item.selectedFoodId ? foodsMap.get(item.selectedFoodId) : null;
            const suggestedGrams = suggestedFood ? Math.round(suggestedFood.baseGrams * item.exchangeCount) : 0;
            const suggestedHouseholdQty = suggestedFood
              ? formatFriendlyFraction(Math.round(suggestedFood.householdQty * item.exchangeCount * 100) / 100)
              : '';

            return (
              <li key={item.id} className="group flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:py-3.5">
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                <span
                  className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: group.color.accent }}
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline gap-2 text-[15px] text-foreground">
                    <span className="truncate font-medium">{group.name}</span>
                    <span className="shrink-0 text-[13px] tabular-nums text-muted">{itemCalories} kcal</span>
                  </p>

                  {suggestedFood ? (
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
                      <span className="truncate">
                        {suggestedFood.name} · {suggestedHouseholdQty} {suggestedFood.householdUnit} ({suggestedGrams} g)
                      </span>
                      <button
                        type="button"
                        onClick={() => onClearSuggestedFood(meal.id, item.id)}
                        className="shrink-0 rounded p-0.5 text-subtle transition-colors hover:bg-surface-muted hover:text-foreground"
                        aria-label="Quitar alimento sugerido"
                        title="Quitar alimento sugerido"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenEquivalents(item, group)}
                      className="mt-0.5 text-sm text-muted underline decoration-border-strong underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
                    >
                      Elegir alimento equivalente
                    </button>
                  )}
                </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-1.5 pl-6 sm:justify-end sm:pl-0">
                  {suggestedFood && (
                    <button
                      type="button"
                      onClick={() => onOpenEquivalents(item, group)}
                      className="mr-auto inline-flex h-8 items-center rounded-lg px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground sm:mr-0"
                    >
                      Cambiar
                    </button>
                  )}
                  <ExchangeStepper
                    value={item.exchangeCount}
                    onChange={(n) => onUpdateItem(meal.id, item.id, n)}
                    label={group.name}
                  />
                  <button
                    type="button"
                    onClick={() => onRemoveItem(meal.id, item.id)}
                    className="rounded-lg p-2 text-subtle opacity-100 transition-colors hover:bg-danger-soft hover:text-danger sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
                    title="Quitar grupo"
                    aria-label={`Quitar ${group.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex border-t border-border px-3 py-2">{addButton}</div>
    </Card>
  );
}
