'use client';

import React from 'react';
import { MealPlanMeal, MealPlanItem, ExchangeGroup, Food } from '@/types/nutrition';
import { formatFriendlyFraction } from '@/core/exchange-engine';
import { Coffee, Cookie, Moon, Plus, Sun, Sunrise, Trash2, Utensils, X } from 'lucide-react';
import { Card } from '@/components/ui';
import { Popover } from '@/components/ui/Popover';
import { ExchangeStepper } from './ExchangeStepper';

const nf = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 2 });

const MEAL_ICONS = { sunrise: Sunrise, coffee: Coffee, sun: Sun, cookie: Cookie, moon: Moon, utensils: Utensils } as const;

/** Icono según el momento del día de la comida. */
function mealIconKey(name: string): keyof typeof MEAL_ICONS {
  const n = name.toLowerCase();
  if (n.includes('desayuno')) return 'sunrise';
  if (n.includes('media') || n.includes('colaci')) return 'coffee';
  if (n.includes('almuerzo')) return 'sun';
  if (n.includes('merienda')) return 'cookie';
  if (n.includes('cena') || n.includes('noct')) return 'moon';
  return 'utensils';
}

interface MealCardProps {
  meal: MealPlanMeal;
  exchangeGroups: ExchangeGroup[];
  allFoods: Food[];
  onUpdateItem: (mealId: string, itemId: string, exchangeCount: number) => void;
  onRemoveItem: (mealId: string, itemId: string) => void;
  onAddItem: (mealId: string, groupId: string, exchangeCount: number) => void;
  onOpenEquivalents: (item: MealPlanItem, group: ExchangeGroup) => void;
  onClearSuggestedFood: (mealId: string, itemId: string) => void;
  /** Posición de la comida en el plan (para el número 01, 02...). */
  index?: number;
}

/**
 * Una comida del plan: encabezado con icono y totales, y una lista de grupos separados por
 * líneas finas. El alimento sugerido es una segunda línea de texto bajo el grupo.
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
  index,
}: MealCardProps) {
  const groupsMap = new Map<string, ExchangeGroup>(exchangeGroups.map((g) => [g.id, g]));
  const foodsMap = new Map<string, Food>(allFoods.map((f) => [f.id, f]));
  const Icon = MEAL_ICONS[mealIconKey(meal.name)];

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

  const addGroup = (triggerClassName: string, align: 'left' | 'right') => (
    <Popover
      align={align}
      panelClassName="w-72"
      triggerLabel="Añadir grupo a esta comida"
      triggerClassName={triggerClassName}
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
      <div className="flex items-center justify-between gap-4 rounded-t-[14px] border-b border-border bg-surface-muted/60 px-5 py-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted"
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            {index !== undefined && (
              <p className="mono-label text-subtle">{String(index + 1).padStart(2, '0')}{meal.time ? ` · ${meal.time}` : ''}</p>
            )}
            <h3 className="text-[22px] font-bold leading-tight tracking-[-0.035em] text-foreground">{meal.name}</h3>
          </div>
        </div>

        <div className="flex shrink-0 items-baseline gap-3 tabular-nums">
          <span className="mono-label hidden text-subtle sm:inline">{nf.format(mealExchanges)} int</span>
          <span className="flex items-baseline gap-1">
            <span className="text-2xl font-bold leading-none tracking-[-0.04em] text-foreground">
              {nf.format(Math.round(mealCalories))}
            </span>
            <span className="text-[13px] text-muted">kcal</span>
          </span>
        </div>
      </div>

      {meal.items.length === 0 ? (
        <div className="px-5 py-9 text-center">
          <p className="text-sm text-muted">Esta comida todavía no tiene grupos.</p>
          <div className="mt-3 flex justify-center">
            {addGroup(
              'inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted',
              'left'
            )}
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
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
                <li
                  key={item.id}
                  className="group flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:py-3.5"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <span
                      className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: group.color.accent }}
                      aria-hidden="true"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2 text-[15px] text-foreground">
                        <span className="truncate font-semibold">{group.name}</span>
                        <span className="mono-label shrink-0 text-subtle">{itemCalories} kcal</span>
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

          <div className="rounded-b-[14px] border-t border-border bg-surface-muted/40 px-3 py-2">
            {addGroup(
              'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-muted',
              'right'
            )}
          </div>
        </>
      )}
    </Card>
  );
}
