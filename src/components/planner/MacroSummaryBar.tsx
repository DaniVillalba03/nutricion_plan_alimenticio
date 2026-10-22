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

/** Anillo de progreso (SVG): el número va al centro. */
function CalorieRing({ percent, over, children }: { percent: number; over: boolean; children: React.ReactNode }) {
  const size = 148;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.min(percent, 100) / 100;

  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label="Calorías"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-surface-muted" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - filled)}
          className={cn('transition-[stroke-dashoffset] duration-500', over ? 'stroke-warning' : 'stroke-primary')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

interface MacroRowProps {
  label: string;
  current: number;
  target: number;
  percentOfTarget: number;
  /** Token de color del macronutriente (bg-macro-*). */
  dotClass: string;
}

function MacroRow({ label, current, target, percentOfTarget, dotClass }: MacroRowProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="flex items-center gap-2 text-foreground">
          <span className={cn('h-2 w-2 rounded-full', dotClass)} aria-hidden="true" />
          {label}
        </span>
        <span className="tabular-nums text-muted">
          <span className="font-medium text-foreground">{nf.format(current)}</span> / {nf.format(target)} g
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(percentOfTarget)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-300', dotClass)}
          style={{ width: `${Math.min(percentOfTarget, 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Balance del plan frente a las metas: anillo de calorías, distribución calórica real
 * frente a la meta, y una fila por macronutriente.
 */
export function MacroSummaryBar({ totals, client, className }: MacroSummaryBarProps) {
  const diff = totals.calories.difference;
  const onTarget = Math.abs(diff) <= 50;
  const over = diff > 50;

  const status = onTarget
    ? { text: 'Meta calórica alcanzada', tone: 'text-primary-text' }
    : over
      ? { text: `Excede la meta por ${nf.format(diff)} kcal`, tone: 'text-warning' }
      : { text: `Faltan ${nf.format(Math.abs(diff))} kcal`, tone: 'text-muted' };

  const split = [
    { key: 'CHO', pct: totals.carbohydrates.distributionPct, target: client.macroDistributionPct.carbohydrates, cls: 'bg-macro-cho' },
    { key: 'PRO', pct: totals.proteins.distributionPct, target: client.macroDistributionPct.proteins, cls: 'bg-macro-pro' },
    { key: 'LIP', pct: totals.lipids.distributionPct, target: client.macroDistributionPct.lipids, cls: 'bg-macro-lip' },
  ];
  const splitTotal = split.reduce((a, b) => a + b.pct, 0);

  return (
    <section
      aria-label="Balance nutricional"
      className={cn('overflow-hidden rounded-[14px] border border-border bg-surface', className)}
    >
      <div className="border-b border-border bg-surface-muted/60 px-5 py-3.5">
        <h2 className="mono-label text-subtle">Balance · hoy</h2>
      </div>

      <div className="px-5 pb-5 pt-6">
        <CalorieRing percent={totals.calories.percentageOfTarget} over={over}>
          <span className="text-[38px] font-bold leading-none tracking-[-0.045em] tabular-nums text-foreground">
            {nf.format(totals.calories.current)}
          </span>
          <span className="mt-1 text-[13px] tabular-nums text-muted">de {nf.format(client.targetCalories)} kcal</span>
        </CalorieRing>
        <p className={cn('mt-3 text-center text-sm font-medium', status.tone)}>{status.text}</p>
      </div>

      <div className="space-y-4 border-t border-border px-5 py-5">
        <MacroRow
          label="Carbohidratos"
          current={totals.carbohydrates.current}
          target={client.targetMacros.carbohydrates}
          percentOfTarget={totals.carbohydrates.percentageOfTarget}
          dotClass="bg-macro-cho"
        />
        <MacroRow
          label="Proteínas"
          current={totals.proteins.current}
          target={client.targetMacros.proteins}
          percentOfTarget={totals.proteins.percentageOfTarget}
          dotClass="bg-macro-pro"
        />
        <MacroRow
          label="Lípidos"
          current={totals.lipids.current}
          target={client.targetMacros.lipids}
          percentOfTarget={totals.lipids.percentageOfTarget}
          dotClass="bg-macro-lip"
        />
      </div>

      <div className="border-t border-border px-5 py-4">
        <p className="mono-label text-subtle">Distribución calórica</p>
        <div className="mt-2.5 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
          {splitTotal > 0 &&
            split.map((s) => <div key={s.key} className={s.cls} style={{ width: `${(s.pct / splitTotal) * 100}%` }} />)}
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-[13px]">
          {split.map((s) => (
            <div key={s.key}>
              <dt className="mono-label text-muted">{s.key}</dt>
              <dd className="tabular-nums">
                <span className="text-[17px] font-bold tracking-[-0.03em] text-foreground">{Math.round(s.pct)}%</span>
                <span className="block text-xs text-subtle">meta {s.target}%</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mono-label border-t border-border bg-surface-muted/60 px-5 py-3 text-subtle">
        {nf.format(totals.totalExchanges)} intercambios en total
      </div>
    </section>
  );
}

/** Resumen fijo al pie, solo en móvil: las calorías son lo que más se mira mientras se arma el plan. */
export function MacroMiniBar({ totals, client }: Pick<MacroSummaryBarProps, 'totals' | 'client'>) {
  const diff = totals.calories.difference;
  const onTarget = Math.abs(diff) <= 50;
  const over = diff > 50;
  const bar = over ? 'bg-warning' : 'bg-primary';

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-5 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg items-baseline justify-between text-sm">
        <span className="tabular-nums">
          <span className="text-xl font-bold tracking-[-0.04em] text-foreground">{nf.format(totals.calories.current)}</span>
          <span className="text-muted"> / {nf.format(client.targetCalories)} kcal</span>
        </span>
        <span className={onTarget ? 'text-primary-text' : over ? 'text-warning' : 'text-muted'}>
          {onTarget ? 'Meta alcanzada' : over ? `+${nf.format(diff)} kcal` : `Faltan ${nf.format(Math.abs(diff))}`}
        </span>
      </div>
      <div className="mx-auto mt-2 h-1.5 max-w-lg overflow-hidden rounded-full bg-surface-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-300', bar)}
          style={{ width: `${Math.min(totals.calories.percentageOfTarget, 100)}%` }}
        />
      </div>
    </div>
  );
}
