'use client';

import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MealPlan, Client, ExchangeGroup, Food } from '@/types/nutrition';
import { calculatePlanTotals, formatFriendlyFraction, getFoodEquivalents } from '@/core/exchange-engine';
import { Printer, X, AlertTriangle, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Brand } from '@/components/layout/Brand';
import { MEAL_ICONS, mealIconKey } from './meal-icons';

interface PlanPdfViewProps {
  isOpen: boolean;
  onClose: () => void;
  plan: MealPlan;
  client: Client;
  exchangeGroups: ExchangeGroup[];
  allFoods: Food[];
}

const nf = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 1 });

/** Etiqueta mono en mayúsculas pequeñas, igual que en la app. */
function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`mono-label text-subtle ${className}`}>{children}</p>;
}

/** Tarjeta de dato: etiqueta, cifra grande y unidad pequeña. `inverse` la pone en tinta. */
function Stat({
  label,
  value,
  unit,
  hint,
  dot,
  inverse,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  dot?: string;
  inverse?: boolean;
}) {
  return (
    <div
      className={`min-w-0 rounded-[12px] border px-3.5 py-3 ${
        inverse ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface'
      }`}
    >
      <p className={`mono-label flex items-center gap-1.5 ${inverse ? 'text-accent-foreground/70' : 'text-subtle'}`}>
        {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />}
        {label}
      </p>
      <p className="mt-1.5 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-[28px] font-bold leading-none tracking-[-0.04em]">{value}</span>
        {unit && <span className={`text-[13px] ${inverse ? 'text-accent-foreground/70' : 'text-muted'}`}>{unit}</span>}
        {hint && <span className="mono-label ml-auto text-subtle">{hint}</span>}
      </p>
    </div>
  );
}

/**
 * Vista previa e impresión del plan en A4. El documento fuerza la paleta clara
 * (`force-light`) para que se vea y se imprima igual con cualquier tema de la app.
 */
export function PlanPdfView({ isOpen, onClose, plan, client, exchangeGroups, allFoods }: PlanPdfViewProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const groupsMap = useMemo(() => new Map<string, ExchangeGroup>(exchangeGroups.map((g) => [g.id, g])), [exchangeGroups]);
  const foodsMap = useMemo(() => new Map<string, Food>(allFoods.map((f) => [f.id, f])), [allFoods]);
  const totals = useMemo(() => calculatePlanTotals(plan, exchangeGroups, client), [plan, exchangeGroups, client]);

  if (!isOpen) return null;

  // Comprobar si el plan contiene ítems discrecionales
  const hasDiscretionary = plan.meals.some((meal) =>
    meal.items.some((item) => {
      const g = groupsMap.get(item.groupId);
      return g?.isDiscretionary || g?.category === 'discrecional';
    })
  );

  const today = new Date().toLocaleDateString('es-PY');
  const dayKcal = totals.calories.current;

  const split = [
    { key: 'CHO', label: 'Carbohidratos', pct: totals.carbohydrates.distributionPct, cls: 'bg-macro-cho' },
    { key: 'PRO', label: 'Proteínas', pct: totals.proteins.distributionPct, cls: 'bg-macro-pro' },
    { key: 'LIP', label: 'Lípidos', pct: totals.lipids.distributionPct, cls: 'bg-macro-lip' },
  ];
  const splitTotal = split.reduce((a, b) => a + b.pct, 0);

  // Portal al <body>: al imprimir, globals.css oculta todo lo que no sea [data-print-root].
  return createPortal(
    <div
      data-print-root
      role="dialog"
      aria-modal="true"
      aria-label="Vista de impresión del plan"
      className="fixed inset-0 z-50 overflow-y-auto bg-overlay p-3 backdrop-blur-sm sm:p-8 print:p-0"
    >
      {/* Barra de acciones (se oculta al imprimir) */}
      <div className="sticky top-0 z-10 mx-auto mb-4 flex max-w-[820px] items-center justify-end gap-2 print:hidden">
        <div className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 p-1.5 backdrop-blur">
          <Button variant="primary" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Imprimir / Guardar PDF
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Cerrar vista de impresión"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Documento A4 */}
      <article className="force-light mx-auto w-full max-w-[820px] rounded-[18px] bg-background p-8 font-sans text-foreground shadow-[0_30px_80px_-30px_rgb(0_0_0/0.6)] sm:p-12 print:max-w-none print:rounded-none print:bg-white print:px-[1.5mm] print:py-0 print:shadow-none">
        {/* 1. Cabecera con degradado de marca */}
        <header className="relative overflow-hidden rounded-[18px] border border-border bg-gradient-to-br from-primary-soft via-surface to-surface px-7 py-6">
          <Leaf
            className="pointer-events-none absolute -right-6 -top-6 h-44 w-44 rotate-12 text-primary/10"
            strokeWidth={1.2}
            aria-hidden="true"
          />
          <div className="relative flex items-center justify-between gap-4">
            <Brand size="md" />
            <Label className="text-right">
              v{(plan.versionNumber || 1).toFixed(1)} · {today}
            </Label>
          </div>

          <div className="relative mt-8">
            <p className="mono-label flex items-center gap-2 text-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              Plan de alimentación por intercambios
            </p>
            <h1 className="mt-3 text-[44px] leading-[1.02] text-foreground">{client.fullName}</h1>
            <p className="mt-3 text-[15px] text-muted">
              Lic. Laura Molinas · Lic. en Nutrición · Reg. Prof. 6020 · Asunción, Paraguay
            </p>
          </div>
        </header>

        {/* 2. Metas del paciente */}
        <section aria-label="Metas del paciente" className="mt-5">
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 print:grid-cols-4">
            <Stat inverse label="Meta diaria" value={nf.format(client.targetCalories)} unit="kcal" />
            <Stat
              label="Carbohidratos"
              dot="bg-macro-cho"
              value={nf.format(client.targetMacros.carbohydrates)}
              unit="g"
              hint={`${client.macroDistributionPct.carbohydrates}%`}
            />
            <Stat
              label="Proteínas"
              dot="bg-macro-pro"
              value={nf.format(client.targetMacros.proteins)}
              unit="g"
              hint={`${client.macroDistributionPct.proteins}%`}
            />
            <Stat
              label="Lípidos"
              dot="bg-macro-lip"
              value={nf.format(client.targetMacros.lipids)}
              unit="g"
              hint={`${client.macroDistributionPct.lipids}%`}
            />
          </dl>

          {/* Distribución de macronutrientes de la meta */}
          <div className="mt-2.5 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
            <div className="bg-macro-cho" style={{ width: `${client.macroDistributionPct.carbohydrates}%` }} />
            <div className="bg-macro-pro" style={{ width: `${client.macroDistributionPct.proteins}%` }} />
            <div className="bg-macro-lip" style={{ width: `${client.macroDistributionPct.lipids}%` }} />
          </div>

          {client.exclusions && client.exclusions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[12px] border border-danger/25 bg-danger-soft px-4 py-2.5">
              <Label className="!text-danger-soft-foreground">Restricciones</Label>
              <span className="text-sm text-danger-soft-foreground">
                {client.exclusions.join(', ')} · excluidas automáticamente de los equivalentes.
              </span>
            </div>
          )}

          {/* Medidas caseras de referencia */}
          <div className="mt-3 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-[12px] border border-border bg-surface-muted">
            {[
              ['1 taza', '200 ml'],
              ['1 cucharada', '10 ml'],
              ['1 cucharadita', '5 ml'],
            ].map(([k, v]) => (
              <div key={k} className="px-4 py-2 text-center">
                <p className="mono-label text-subtle">{k}</p>
                <p className="text-[15px] font-semibold tabular-nums text-foreground">{v} / cc</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Comidas y equivalentes */}
        <section aria-label="Comidas del día" className="mt-8">
          <h2 className="break-after-avoid text-[28px] font-bold text-foreground">Comidas del día</h2>

          <div className="mt-4 space-y-5">
            {plan.meals.map((meal, mealIndex) => {
              const mealKcal = meal.items.reduce((acc, item) => {
                const g = groupsMap.get(item.groupId);
                return acc + (g ? g.referenceMacros.calories * item.exchangeCount : 0);
              }, 0);
              const share = dayKcal > 0 ? Math.min(100, (mealKcal / dayKcal) * 100) : 0;
              const MealIcon = MEAL_ICONS[mealIconKey(meal.name)];

              return (
                <div key={meal.id} className="rounded-[14px] border border-border bg-surface [-webkit-box-decoration-break:clone] [box-decoration-break:clone]">
                  {/* Cabecera de la comida: icono, nombre, kcal y % del día */}
                  <div className="break-inside-avoid break-after-avoid rounded-t-[13px] border-b border-border bg-surface-muted px-5 py-3.5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                          aria-hidden="true"
                        >
                          <MealIcon className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div className="min-w-0">
                          <p className="mono-label text-subtle">
                            {String(mealIndex + 1).padStart(2, '0')}
                            {meal.time ? ` · ${meal.time}` : ''}
                          </p>
                          <h3 className="text-[21px] font-bold leading-tight tracking-[-0.035em] text-foreground">{meal.name}</h3>
                        </div>
                      </div>
                      <p className="flex shrink-0 items-baseline gap-1 tabular-nums">
                        <span className="text-[26px] font-bold leading-none tracking-[-0.04em] text-foreground">
                          {nf.format(Math.round(mealKcal))}
                        </span>
                        <span className="text-[13px] text-muted">kcal</span>
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                      </div>
                      <span className="mono-label shrink-0 text-subtle">{Math.round(share)}% del día</span>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {meal.items.length === 0 && <p className="px-5 py-5 text-sm text-muted">Sin grupos asignados.</p>}
                    {meal.items.map((item) => {
                      const group = groupsMap.get(item.groupId);
                      if (!group) return null;

                      const friendlyExchanges = formatFriendlyFraction(item.exchangeCount);
                      const suggestedFood = item.selectedFoodId ? foodsMap.get(item.selectedFoodId) : null;
                      const suggestedGrams = suggestedFood ? Math.round(suggestedFood.baseGrams * item.exchangeCount) : 0;
                      const suggestedHousehold = suggestedFood
                        ? `${formatFriendlyFraction(Math.round(suggestedFood.householdQty * item.exchangeCount * 100) / 100)} ${suggestedFood.householdUnit}`
                        : '';

                      // 3 equivalentes directos permitidos (no excluidos)
                      const directEquivalents = getFoodEquivalents(group.id, item.exchangeCount, allFoods, client)
                        .filter((eq) => !eq.isExcluded && eq.food.id !== item.selectedFoodId)
                        .slice(0, 3);

                      return (
                        <div
                          key={item.id}
                          className="grid grid-cols-1 gap-x-4 gap-y-3 break-inside-avoid px-5 py-3.5 md:grid-cols-12 print:grid-cols-12"
                        >
                          {/* Grupo e intercambios */}
                          <div className="md:col-span-3 print:col-span-3">
                            <p className="flex items-start gap-2 text-[14px] font-semibold leading-snug text-foreground">
                              <span
                                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: group.color.accent }}
                                aria-hidden="true"
                              />
                              {group.name}
                            </p>
                            <p className="mt-2 inline-flex items-baseline gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1 tabular-nums">
                              <span className="text-[17px] font-bold leading-none tracking-[-0.03em] text-foreground">
                                {friendlyExchanges}
                              </span>
                              <span className="text-[12px] text-muted">{item.exchangeCount === 1 ? 'int.' : 'int.'}</span>
                            </p>
                            <p className="mono-label mt-1.5 text-subtle">
                              {Math.round(group.referenceMacros.calories * item.exchangeCount)} kcal
                            </p>
                          </div>

                          {/* Sugerencia principal */}
                          <div className="flex md:col-span-4 print:col-span-4">
                            <div className="self-start rounded-[10px] border border-primary/30 bg-primary-soft px-3.5 py-2.5">
                              <p className="mono-label text-primary-soft-foreground">Sugerencia principal</p>
                              {suggestedFood ? (
                                <>
                                  <p className="mt-1 text-[14px] font-semibold leading-snug text-foreground">{suggestedFood.name}</p>
                                  <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-primary-text">
                                    {suggestedHousehold} <span className="font-normal text-muted">({suggestedGrams} g)</span>
                                  </p>
                                </>
                              ) : (
                                <p className="mt-1 text-[13px] italic text-muted">Cualquier equivalente de la lista.</p>
                              )}
                            </div>
                          </div>

                          {/* Otras opciones */}
                          <div className="md:col-span-5 print:col-span-5">
                            <p className="mono-label text-subtle">Otras opciones equivalentes</p>
                            <ul className="mt-1.5 space-y-1">
                              {directEquivalents.map((eq) => (
                                <li key={eq.food.id} className="flex items-baseline gap-2 text-[13px] leading-snug">
                                  <span className="min-w-0 text-muted">{eq.food.name}</span>
                                  <span className="mb-1 min-w-3 flex-1 border-b border-dotted border-border-strong" aria-hidden="true" />
                                  <span className="shrink-0 font-semibold tabular-nums text-foreground">{eq.formattedHousehold}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumen del día */}
          <div className="mt-5 break-inside-avoid overflow-hidden rounded-[14px] border border-accent bg-accent text-accent-foreground">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <p className="mono-label text-accent-foreground/70">Total del plan</p>
              <p className="flex items-baseline gap-2 tabular-nums">
                <span className="text-[32px] font-bold leading-none tracking-[-0.045em]">{nf.format(dayKcal)}</span>
                <span className="text-sm text-accent-foreground/70">
                  de {nf.format(client.targetCalories)} kcal · {nf.format(totals.totalExchanges)} intercambios
                </span>
              </p>
            </div>
            <div className="border-t border-white/15 px-6 py-3.5">
              <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                {splitTotal > 0 &&
                  split.map((s) => <div key={s.key} className={s.cls} style={{ width: `${(s.pct / splitTotal) * 100}%` }} />)}
              </div>
              <dl className="mt-2.5 grid grid-cols-3 gap-3">
                {split.map((s) => (
                  <div key={s.key} className="flex items-baseline gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${s.cls}`} aria-hidden="true" />
                    <dt className="mono-label text-accent-foreground/70">{s.key}</dt>
                    <dd className="text-sm font-semibold tabular-nums">{Math.round(s.pct)}%</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* 4. Aviso educativo (si hay alimentos discrecionales) */}
        {hasDiscretionary && (
          <aside className="mt-5 break-inside-avoid rounded-[14px] border border-warning/30 bg-warning-soft px-5 py-4">
            <p className="mono-label flex items-center gap-2 text-warning-soft-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Aviso sobre alimentos discrecionales
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-warning-soft-foreground">
              Los alimentos discrecionales (galletitas comerciales, masas de tarta o empanada y bebidas alcohólicas) aportan
              calorías de digestión rápida o calorías vacías derivadas de grasas saturadas, azúcares simples o alcohol.
              Su inclusión debe ser moderada y eventual, priorizando siempre alimentos enteros, naturales y no procesados.
            </p>
          </aside>
        )}

        {/* 5. Cierre */}
        <footer className="mt-10 break-inside-avoid rounded-[18px] border border-border bg-gradient-to-br from-primary-soft via-surface to-surface px-7 py-7 text-center">
          <Leaf className="mx-auto h-6 w-6 text-primary-text" strokeWidth={1.8} aria-hidden="true" />
          <p className="mt-3 text-[24px] font-bold leading-snug tracking-[-0.035em] text-foreground">
            Un hábito que fue aprendido puede ser reeducado.
          </p>
          <p className="mt-1.5 text-sm text-muted">Cuida tu cuerpo, solo tienes uno.</p>
          <p className="mono-label mt-5 text-subtle">Lic. Laura Molinas · Reg. Prof. 6020 · Asunción, Paraguay</p>
        </footer>
      </article>
    </div>,
    document.body
  );
}
