import type { AdherenceDay, Measurement } from '@/types/nutrition';

/** Suma `delta` días a una fecha AAAA-MM-DD (aritmética de calendario, sin husos horarios). */
export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return date.toISOString().slice(0, 10);
}

/** Los últimos `n` días terminando en `today`, del más antiguo al más reciente. */
export function lastDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

export interface PlanVersionSummary {
  id: string;
  versionNumber: number;
  mealCount: number;
}

/**
 * Adherencia por día: comidas completadas / comidas del plan ese día. Si en un día hay avance de
 * más de una versión del plan, vale la versión con más comidas completadas; si no hay avance, el
 * total es el de la versión más reciente.
 */
export function buildAdherenceSeries(
  days: string[],
  versions: PlanVersionSummary[],
  rows: { plan_version_id: string; day: string }[]
): AdherenceDay[] {
  const byId = new Map(versions.map((v) => [v.id, v]));
  const latest = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];

  return days.map((day) => {
    const perVersion = new Map<string, number>();
    for (const row of rows) {
      if (row.day === day && byId.has(row.plan_version_id)) {
        perVersion.set(row.plan_version_id, (perVersion.get(row.plan_version_id) ?? 0) + 1);
      }
    }

    let best: { id: string; count: number } | null = null;
    for (const [id, count] of perVersion) if (!best || count > best.count) best = { id, count };

    const version = best ? byId.get(best.id)! : latest;
    const total = version?.mealCount ?? 0;
    return { day, completed: Math.min(best?.count ?? 0, total || best?.count || 0), total };
  });
}

/** Promedio de adherencia (0-100) sobre los días que tenían un plan con comidas; null si no hay datos. */
export function adherenceAverage(series: AdherenceDay[]): number | null {
  const withPlan = series.filter((d) => d.total > 0);
  if (withPlan.length === 0) return null;
  const sum = withPlan.reduce((acc, d) => acc + d.completed / d.total, 0);
  return Math.round((sum / withPlan.length) * 100);
}

export interface WeightStats {
  first: number;
  latest: number;
  /** Cambio en kg desde el primer control (con un decimal). */
  change: number;
  changePct: number;
  /** Índice de masa corporal con el peso más reciente; null sin talla. */
  bmi: number | null;
  count: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Estadísticas de peso a partir de los controles (ordenados por fecha; con la misma fecha, vale el orden recibido). */
export function weightStats(measurements: Measurement[], heightCm?: number): WeightStats | null {
  if (measurements.length === 0) return null;
  const sorted = [...measurements].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
  const first = sorted[0].weightKg;
  const latest = sorted[sorted.length - 1].weightKg;
  const bmi = heightCm && heightCm > 0 ? round1(latest / (heightCm / 100) ** 2) : null;
  return {
    first,
    latest,
    change: round1(latest - first),
    changePct: first > 0 ? round1(((latest - first) / first) * 100) : 0,
    bmi,
    count: sorted.length,
  };
}

export interface ChartPoint {
  x: number;
  y: number;
  label: string;
  value: number;
}

/**
 * Escala los controles al área de un gráfico de líneas. El eje X es proporcional al tiempo
 * (dos controles muy separados se dibujan lejos) y el eje Y se ajusta al rango de pesos con
 * un margen, para que variaciones pequeñas sean visibles.
 */
export function weightChartPoints(
  measurements: Measurement[],
  size: { width: number; height: number; padX: number; padY: number }
): { points: ChartPoint[]; min: number; max: number } {
  const sorted = [...measurements].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
  if (sorted.length === 0) return { points: [], min: 0, max: 0 };

  const values = sorted.map((m) => m.weightKg);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const margin = Math.max((hi - lo) * 0.15, 0.5);
  const min = lo - margin;
  const max = hi + margin;

  // Varios controles el mismo día se reparten dentro de ese día (en el orden en que se registraron)
  const DAY = 86_400_000;
  const perDay = new Map<string, number>();
  for (const m of sorted) perDay.set(m.measuredOn, (perDay.get(m.measuredOn) ?? 0) + 1);
  const seen = new Map<string, number>();
  const t = sorted.map((m) => {
    const k = seen.get(m.measuredOn) ?? 0;
    seen.set(m.measuredOn, k + 1);
    return Date.parse(`${m.measuredOn}T00:00:00Z`) + (k / perDay.get(m.measuredOn)!) * DAY * 0.9;
  });
  const t0 = t[0];
  const span = t[t.length - 1] - t0;
  const innerW = size.width - size.padX * 2;
  const innerH = size.height - size.padY * 2;

  const points = sorted.map((m, i) => ({
    x: size.padX + (span === 0 ? innerW / 2 : ((t[i] - t0) / span) * innerW),
    y: size.padY + (1 - (m.weightKg - min) / (max - min)) * innerH,
    label: m.measuredOn,
    value: m.weightKg,
  }));
  return { points, min, max };
}
