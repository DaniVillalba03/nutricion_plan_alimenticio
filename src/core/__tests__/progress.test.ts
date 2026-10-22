import { describe, it, expect } from 'vitest';
import type { AdherenceDay, Measurement } from '@/types/nutrition';
import { addDays, adherenceAverage, buildAdherenceSeries, lastDays, weightChartPoints, weightStats } from '../progress';

const m = (measuredOn: string, weightKg: number): Measurement => ({ id: measuredOn, measuredOn, weightKg });

describe('fechas', () => {
  it('addDays cruza meses y años', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('lastDays devuelve n días terminando hoy, en orden', () => {
    expect(lastDays('2026-10-22', 3)).toEqual(['2026-10-20', '2026-10-21', '2026-10-22']);
  });
});

describe('buildAdherenceSeries', () => {
  const versions = [
    { id: 'v1', versionNumber: 1, mealCount: 4 },
    { id: 'v2', versionNumber: 2, mealCount: 5 },
  ];

  it('cuenta las comidas completadas por día y rellena los días sin avance', () => {
    const series = buildAdherenceSeries(
      ['2026-10-20', '2026-10-21', '2026-10-22'],
      versions,
      [
        { plan_version_id: 'v2', day: '2026-10-21' },
        { plan_version_id: 'v2', day: '2026-10-21' },
        { plan_version_id: 'v2', day: '2026-10-22' },
      ]
    );
    expect(series).toEqual([
      { day: '2026-10-20', completed: 0, total: 5 },
      { day: '2026-10-21', completed: 2, total: 5 },
      { day: '2026-10-22', completed: 1, total: 5 },
    ]);
  });

  it('un día con avance de una versión anterior usa el total de esa versión', () => {
    const series = buildAdherenceSeries(['2026-10-01'], versions, [{ plan_version_id: 'v1', day: '2026-10-01' }]);
    expect(series[0]).toEqual({ day: '2026-10-01', completed: 1, total: 4 });
  });

  it('ignora avance de versiones que no son del paciente y sin plan el total es 0', () => {
    expect(buildAdherenceSeries(['d'], versions, [{ plan_version_id: 'ajena', day: 'd' }])[0].completed).toBe(0);
    expect(buildAdherenceSeries(['d'], [], [])[0]).toEqual({ day: 'd', completed: 0, total: 0 });
  });
});

describe('adherenceAverage', () => {
  it('promedia solo los días con plan', () => {
    const series: AdherenceDay[] = [
      { day: 'a', completed: 4, total: 4 },
      { day: 'b', completed: 2, total: 4 },
      { day: 'c', completed: 0, total: 0 },
    ];
    expect(adherenceAverage(series)).toBe(75);
  });
  it('sin datos devuelve null', () => {
    expect(adherenceAverage([])).toBeNull();
    expect(adherenceAverage([{ day: 'a', completed: 0, total: 0 }])).toBeNull();
  });
});

describe('weightStats', () => {
  it('calcula cambio, porcentaje e IMC con los controles desordenados', () => {
    const stats = weightStats([m('2026-10-01', 78), m('2026-08-01', 85), m('2026-09-01', 82)], 170);
    expect(stats).toMatchObject({ first: 85, latest: 78, change: -7, changePct: -8.2, count: 3 });
    expect(stats?.bmi).toBe(27); // 78 / 1.7²
  });
  it('sin talla no hay IMC y sin controles no hay estadísticas', () => {
    expect(weightStats([m('2026-10-01', 70)])?.bmi).toBeNull();
    expect(weightStats([])).toBeNull();
  });
});

describe('weightChartPoints', () => {
  const size = { width: 100, height: 50, padX: 10, padY: 5 };

  it('el eje X es proporcional al tiempo y el Y invertido (más peso, más arriba)', () => {
    const { points } = weightChartPoints([m('2026-10-01', 80), m('2026-10-11', 70), m('2026-10-21', 75)], size);
    expect(points.map((p) => p.x)).toEqual([10, 50, 90]);
    expect(points[0].y).toBeLessThan(points[2].y);
    expect(points[2].y).toBeLessThan(points[1].y);
    expect(points[0].y).toBeGreaterThanOrEqual(5);
    expect(points[1].y).toBeLessThanOrEqual(45);
  });

  it('varios controles el mismo día no se encimen: se reparten en orden', () => {
    const { points } = weightChartPoints(
      [m('2026-10-01', 80), { ...m('2026-10-01', 79), id: 'b' }, { ...m('2026-10-01', 78), id: 'c' }, m('2026-10-05', 77)],
      size
    );
    const xs = points.map((p) => p.x);
    expect(new Set(xs).size).toBe(4);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs); // crecen en el orden registrado
    expect(points[0].value).toBe(80);
    expect(points[2].value).toBe(78);
  });

  it('un solo control queda centrado y varios iguales no dividen por cero', () => {
    expect(weightChartPoints([m('2026-10-01', 80)], size).points[0].x).toBe(50);
    const flat = weightChartPoints([m('2026-10-01', 80), m('2026-10-02', 80)], size).points;
    expect(flat.every((p) => Number.isFinite(p.y))).toBe(true);
  });

  it('sin controles no hay puntos', () => {
    expect(weightChartPoints([], size).points).toEqual([]);
  });
});
