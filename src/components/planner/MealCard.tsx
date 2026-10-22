'use client';

import React from 'react';
import { MealPlanMeal, MealPlanItem, ExchangeGroup, Food } from '@/types/nutrition';
import { formatFriendlyFraction, QUICK_EXCHANGE_PRESETS } from '@/core/exchange-engine';
import { Clock, Plus, Trash2, Search, Sparkles, X, Flame } from 'lucide-react';
import { Badge, Card } from '@/components/ui';
import { Popover } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

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

const ADD_BUTTON =
  'inline-flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover';

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
    <>
      <p className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-subtle">Grupo de intercambio</p>
      <div className="max-h-60 space-y-0.5 overflow-y-auto">
        {exchangeGroups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              onAddItem(meal.id, g.id, 1.0);
              close();
            }}
            className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
          >
            <span className="font-medium text-foreground">{g.name}</span>
            <span className="text-xs text-muted">{g.referenceMacros.calories} kcal</span>
          </button>
        ))}
      </div>
    </>
  );

  return (
    <Card className="flex flex-col overflow-hidden">
      {/* Encabezado de la comida */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-xs font-bold text-primary-soft-foreground">
            {meal.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">{meal.name}</h3>
              {meal.time && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Clock className="h-3 w-3" /> {meal.time}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              {meal.items.length} {meal.items.length === 1 ? 'grupo' : 'grupos'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge>{Math.round(mealExchanges * 100) / 100} int</Badge>
          <Badge tone="primary">
            <Flame className="h-3 w-3" />
            {Math.round(mealCalories)} kcal
          </Badge>
          <Popover
            panelClassName="w-64"
            triggerLabel="Añadir grupo a esta comida"
            triggerClassName={ADD_BUTTON}
            trigger={
              <>
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Añadir</span>
              </>
            }
          >
            {groupMenu}
          </Popover>
        </div>
      </div>

      {/* Grupos */}
      <div className="flex-1 space-y-2 p-3.5">
        {meal.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-6 text-center">
            <p className="text-xs text-muted">Sin grupos asignados a esta comida.</p>
            <div className="mt-2 flex justify-center">
              <Popover
                align="left"
                panelClassName="w-64"
                triggerClassName="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                trigger={
                  <>
                    <Plus className="h-3 w-3" /> Añadir primer grupo
                  </>
                }
              >
                {groupMenu}
              </Popover>
            </div>
          </div>
        ) : (
          meal.items.map((item) => {
            const group = groupsMap.get(item.groupId);
            if (!group) return null;

            const itemCalories = Math.round(group.referenceMacros.calories * item.exchangeCount);
            const suggestedFood = item.selectedFoodId ? foodsMap.get(item.selectedFoodId) : null;
            const suggestedGrams = suggestedFood ? Math.round(suggestedFood.baseGrams * item.exchangeCount) : 0;
            const suggestedHouseholdQty = suggestedFood
              ? formatFriendlyFraction(Math.round(suggestedFood.householdQty * item.exchangeCount * 100) / 100)
              : '';

            return (
              <div
                key={item.id}
                className="space-y-2.5 rounded-xl border border-border bg-surface-muted/40 p-3 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color.accent }}
                      aria-hidden="true"
                    />
                    <span className="truncate text-sm font-semibold text-foreground">{group.name}</span>
                    <span className="shrink-0 text-xs text-muted">{itemCalories} kcal</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenEquivalents(item, group)}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-xs font-semibold text-primary-soft-foreground transition-colors hover:bg-primary-soft"
                      title="Ver equivalencias locales en Paraguay"
                    >
                      <Search className="h-3 w-3" />
                      Equivalentes
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(meal.id, item.id)}
                      className="rounded-lg p-1.5 text-subtle transition-colors hover:bg-danger-soft hover:text-danger"
                      title="Quitar grupo"
                      aria-label={`Quitar ${group.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Porción en intercambios">
                    {QUICK_EXCHANGE_PRESETS.map((preset) => {
                      const isCurrent = Math.abs(item.exchangeCount - preset) < 0.01;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => onUpdateItem(meal.id, item.id, preset)}
                          aria-pressed={isCurrent}
                          className={cn(
                            'h-7 min-w-8 rounded-lg px-2 text-xs font-semibold transition-colors',
                            isCurrent
                              ? 'bg-primary text-primary-foreground'
                              : 'border border-border bg-surface text-muted hover:bg-surface-muted hover:text-foreground'
                          )}
                        >
                          {formatFriendlyFraction(preset)}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <input
                      type="number"
                      step="0.25"
                      min="0.25"
                      max="10"
                      value={item.exchangeCount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) onUpdateItem(meal.id, item.id, val);
                      }}
                      className="h-7 w-14 rounded-lg border border-border bg-surface text-center text-xs font-semibold text-foreground focus:border-ring focus:outline-none"
                      aria-label="Cantidad manual de intercambios"
                    />
                    <span className="text-xs text-muted">int</span>
                  </div>
                </div>

                {suggestedFood && (
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-primary-soft px-2.5 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="truncate font-semibold text-primary-soft-foreground">{suggestedFood.name}:</span>
                      <span className="truncate text-primary-soft-foreground/80">
                        {suggestedHouseholdQty} {suggestedFood.householdUnit} ({suggestedGrams} g)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onClearSuggestedFood(meal.id, item.id)}
                      className="rounded p-1 text-primary-soft-foreground transition-colors hover:bg-primary/20"
                      title="Quitar sugerencia fija"
                      aria-label="Quitar sugerencia fija"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
