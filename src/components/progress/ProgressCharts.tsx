import React from 'react';
import type { AdherenceDay, Measurement } from '@/types/nutrition';
import { weightChartPoints } from '@/core/progress';

const dateFmt = new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: 'short', timeZone: 'UTC' });
const fmtDay = (day: string) => dateFmt.format(new Date(`${day}T00:00:00Z`));
const kg = (n: number) => n.toLocaleString('es-PY', { maximumFractionDigits: 1 });

const W = 640;
const H = 220;

/** Evolución del peso: línea con un punto por control, con el rango de peso y las fechas extremas. */
export function WeightChart({ measurements }: { measurements: Measurement[] }) {
  if (measurements.length < 2) {
    return (
      <p className="rounded-xl border border-dashed border-border-strong px-4 py-10 text-center text-[15px] text-muted">
        {measurements.length === 0
          ? 'Todavía no hay controles. Registra el primero para empezar el seguimiento.'
          : 'Registra otro control para ver la evolución del peso.'}
      </p>
    );
  }

  const { points, min, max } = weightChartPoints(measurements, { width: W, height: H, padX: 44, padY: 22 });
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L${last.x.toFixed(1)},${H - 22} L${first.x.toFixed(1)},${H - 22} Z`;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Peso de ${fmtDay(first.label)} a ${fmtDay(last.label)}: de ${kg(first.value)} a ${kg(last.value)} kg`}
      >
        {/* Referencias del rango */}
        {[max, (max + min) / 2, min].map((v, i) => {
          const y = 22 + (i / 2) * (H - 44);
          return (
            <g key={i}>
              <line x1={44} x2={W - 44} y1={y} y2={y} className="stroke-border" strokeDasharray="3 4" />
              <text x={38} y={y + 4} textAnchor="end" className="fill-subtle text-xs">
                {kg(v)}
              </text>
            </g>
          );
        })}

        <path d={area} className="fill-primary" fillOpacity="0.12" />
        <path d={line} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r="4.5" className="fill-surface stroke-primary" strokeWidth="2.5">
            <title>{`${fmtDay(p.label)}: ${kg(p.value)} kg`}</title>
          </circle>
        ))}

        <text x={first.x} y={H - 4} textAnchor="start" className="fill-subtle text-xs">
          {fmtDay(first.label)}
        </text>
        <text x={last.x} y={H - 4} textAnchor="end" className="fill-subtle text-xs">
          {fmtDay(last.label)}
        </text>
      </svg>
    </figure>
  );
}

/** Comidas completadas por día: una barra por día, con el total del plan como altura completa. */
export function AdherenceBars({ series }: { series: AdherenceDay[] }) {
  const hasData = series.some((d) => d.completed > 0);
  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]" role="img" aria-label="Comidas completadas por día">
        {series.map((d) => {
          const pct = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0;
          return (
            <div
              key={d.day}
              title={`${fmtDay(d.day)}: ${d.completed} de ${d.total} comidas`}
              className="flex h-full flex-1 items-end rounded-sm bg-surface-muted"
            >
              <div className="w-full rounded-sm bg-primary" style={{ height: `${pct}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mono-label mt-2 flex justify-between text-subtle">
        <span>{fmtDay(series[0]?.day ?? '1970-01-01')}</span>
        <span>{hasData ? 'hoy' : 'Sin registros todavía'}</span>
      </div>
    </div>
  );
}
