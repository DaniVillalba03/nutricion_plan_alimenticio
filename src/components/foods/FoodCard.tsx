import React from 'react';
import { Award, CheckCircle2, Flame, Tag } from 'lucide-react';
import type { ExchangeGroup, ExchangeSubgroup, Food } from '@/types/nutrition';
import { validateAtwater449 } from '@/core/exchange-engine';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

interface FoodCardProps {
  food: Food;
  group: ExchangeGroup;
  subgroup?: ExchangeSubgroup | null;
}

export function FoodCard({ food, group, subgroup }: FoodCardProps) {
  const atwater = validateAtwater449(
    group.referenceMacros.carbohydrates,
    group.referenceMacros.proteins,
    group.referenceMacros.lipids,
    group.referenceMacros.calories
  );

  return (
    <article
      className={cn(
        'flex flex-col justify-between gap-4 rounded-2xl border bg-surface p-4 shadow-sm transition-colors',
        food.isParaguayanMarked ? 'border-warning/50' : 'border-border hover:border-border-strong'
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-lg border px-2.5 py-1 text-xs font-semibold', group.color.badge)}>
              {group.shortName}
            </span>
            {food.isParaguayanMarked && (
              <Badge tone="warning">
                <Award className="h-3 w-3" /> Sello (*)
              </Badge>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-muted">
            <Flame className="h-3.5 w-3.5 text-warning" />
            {group.referenceMacros.calories} kcal
          </span>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-bold text-foreground">{food.name}</h3>
            {food.state !== 'no_aplica' && <Badge className="shrink-0 uppercase">{food.state}</Badge>}
          </div>
          {food.brand && <p className="mt-0.5 text-xs font-semibold text-primary">Marca: {food.brand}</p>}
          {subgroup && <p className="mt-0.5 text-xs text-muted">Subgrupo: {subgroup.name}</p>}
          {food.notes && <p className="mt-1 text-xs text-muted">{food.notes}</p>}
        </div>

        <div className="rounded-xl bg-primary-soft p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-soft-foreground">
            Porción para 1 intercambio
          </p>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold text-foreground">{food.portionDescription}</span>
            <span className="font-mono text-xs font-semibold text-primary-soft-foreground">{food.baseGrams}g</span>
          </div>
        </div>

        {food.aliases && food.aliases.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-subtle">Sinónimos en Paraguay</p>
            <div className="flex flex-wrap gap-1">
              {food.aliases.map((alias) => (
                <span
                  key={alias}
                  className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted"
                >
                  {alias}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted">
        <span className="flex min-w-0 items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 shrink-0 text-subtle" />
          <span className="truncate">{(food.tags || []).join(' · ') || food.source || 'Estándar'}</span>
        </span>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded bg-primary-soft px-1.5 py-0.5 font-mono text-xs font-semibold text-primary-soft-foreground"
          title={`Validado 4/4/9 Atwater: ${atwater.calculatedCalories} kcal (${atwater.diffPercent}% discrepancia)`}
        >
          <CheckCircle2 className="h-3 w-3" /> 4/4/9
        </span>
      </div>
    </article>
  );
}
