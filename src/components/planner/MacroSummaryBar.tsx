'use client';

import React from 'react';
import { PlanTotals, Client } from '@/types/nutrition';
import { cn } from '@/lib/utils';

interface MacroSummaryBarProps {
  totals: PlanTotals;
  client: Client;
  className?: string;
}

const nf = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 });

interface MacroRowProps {
  label: string;
  current: number;
  target: number;
  percentOfTarget: number;
  /** Clase de color de la barra (token de macronutriente). */
  barClass: string;
}

function MacroRow({ label, current, target, percentOfTarget, barClass }: MacroRowProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-foreground">{label}</span>
        <span className="tabular-nums text-muted">
          <span className="font-medium text-foreground">{nf.format(current)}</span> / {nf.format(target)} g
        </span>
      </div>
      <div
        className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(percentOfTarget)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', barClass)}
          style={{ width: `${Math.min(percentOfTarget, 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Balance del plan frente a las metas del paciente. Una cifra grande (las calorías),
 * una frase de estado y tres filas finas para los macronutrientes.
 */
export function MacroSummaryBar({ totals, client, className }: MacroSummaryBarProps) {
  const diff = totals.calories.difference;
  const onTarget = Math.abs(diff) <= 50;
  const over = diff > 50;

  const status = onTarget
    ? { text: 'Meta calórica alcanzada', tone: 'text-primary' }
    : over
      ? { text: `Excede la meta por ${nf.format(diff)} kcal`, tone: 'text-warning' }
      : { text: `Faltan ${nf.format(Math.abs(diff))} kcal`, tone: 'text-muted' };

  const calBar = onTarget ? 'bg-primary' : over ? 'bg-warning' : 'bg-foreground/70';

  return (
    <section aria-label="Balance nutricional" className={cn('rounded-xl border border-border bg-surface p-5', className)}>
      <p className="text-[13px] font-medium text-muted">Balance del día</p>

      <p className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-[44px] font-medium leading-none tabular-nums text-foreground">
          {nf.format(totals.calories.current)}
        </span>
        <span className="text-sm tabular-nums text-muted">/ {nf.format(client.targetCalories)} kcal</span>
      </p>
      <p className={cn('mt-1.5 text-sm', status.tone)}>{status.text}</p>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-label="Calorías"
        aria-valuenow={Math.round(totals.calories.percentageOfTarget)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', calBar)}
          style={{ width: `${Math.min(totals.calories.percentageOfTarget, 100)}%` }}
        />
      </div>

      <div className="mt-6 space-y-4 border-t border-border pt-5">
        <MacroRow
          label="Carbohidratos"
          current={totals.carbohydrates.current}
          target={client.targetMacros.carbohydrates}
          percentOfTarget={totals.carbohydrates.percentageOfTarget}
          barClass="bg-macro-cho"
        />
        <MacroRow
          label="Proteínas"
          current={totals.proteins.current}
          target={client.targetMacros.proteins}
          percentOfTarget={totals.proteins.percentageOfTarget}
          barClass="bg-macro-pro"
        />
        <MacroRow
          label="Lípidos"
          current={totals.lipids.current}
          target={client.targetMacros.lipids}
          percentOfTarget={totals.lipids.percentageOfTarget}
          barClass="bg-macro-lip"
        />
      </div>

      <p className="mt-5 text-[13px] tabular-nums text-muted">
        {nf.format(totals.totalExchanges)} intercambios en total
      </p>
    </section>
  );
}

/** Resumen fijo al pie, solo en móvil: las calorías son lo que más se mira mientras se arma el plan. */
export function MacroMiniBar({ totals, client }: Pick<MacroSummaryBarProps, 'totals' | 'client'>) {
  const diff = totals.calories.difference;
  const onTarget = Math.abs(diff) <= 50;
  const over = diff > 50;
  const bar = onTarget ? 'bg-primary' : over ? 'bg-warning' : 'bg-foreground/70';

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-baseline justify-between text-sm">
        <span className="tabular-nums">
          <span className="font-display text-xl font-medium text-foreground">{nf.format(totals.calories.current)}</span>
          <span className="text-muted"> / {nf.format(client.targetCalories)} kcal</span>
        </span>
        <span className={onTarget ? 'text-primary' : over ? 'text-warning' : 'text-muted'}>
          {onTarget ? 'Meta alcanzada' : over ? `+${nf.format(diff)} kcal` : `Faltan ${nf.format(Math.abs(diff))}`}
        </span>
      </div>
      <div className="mx-auto mt-2 h-1 max-w-lg overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-300', bar)}
          style={{ width: `${Math.min(totals.calories.percentageOfTarget, 100)}%` }}
        />
      </div>
    </div>
  );
}
