'use client';

import React from 'react';
import { PlanTotals, Client } from '@/types/nutrition';
import { Flame, Wheat, Drumstick, Droplets, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge, Card } from '@/components/ui';

interface MacroSummaryBarProps {
  totals: PlanTotals;
  client: Client;
}

interface MacroTileProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  target: string;
  /** Texto de la esquina superior derecha (porcentaje de la meta o del reparto). */
  badge: string;
  percentOfTarget: number;
  barClass: string;
}

function MacroTile({ icon, label, value, unit, target, badge, percentOfTarget, barClass }: MacroTileProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface-muted/50 p-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-foreground">
          {icon}
          {label}
        </span>
        <span className="font-semibold text-muted">{badge}</span>
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-xl font-bold tracking-tight text-foreground">
          {value}
          <span className="ml-0.5 text-xs font-medium text-muted">{unit}</span>
        </span>
        <span className="text-xs text-subtle">Meta: {target}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(percentOfTarget)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClass}`}
          style={{ width: `${Math.min(percentOfTarget, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function MacroSummaryBar({ totals, client }: MacroSummaryBarProps) {
  const isCaloriesOk = Math.abs(totals.calories.difference) <= 50;
  const isCaloriesOver = totals.calories.difference > 50;

  const calBar = isCaloriesOk ? 'bg-primary' : isCaloriesOver ? 'bg-warning' : 'bg-info';

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground">Balance nutricional</h2>
          <Badge>{totals.totalExchanges} intercambios</Badge>
        </div>

        {isCaloriesOk ? (
          <Badge tone="primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Meta calórica alcanzada
          </Badge>
        ) : isCaloriesOver ? (
          <Badge tone="warning">
            <AlertCircle className="h-3.5 w-3.5" />
            Excede por +{totals.calories.difference} kcal
          </Badge>
        ) : (
          <Badge tone="info">
            <AlertCircle className="h-3.5 w-3.5" />
            Faltan {Math.abs(totals.calories.difference)} kcal
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MacroTile
          icon={<Flame className="h-4 w-4 text-warning" />}
          label="Calorías"
          value={totals.calories.current}
          unit="kcal"
          target={`${client.targetCalories}`}
          badge={`${totals.calories.percentageOfTarget}%`}
          percentOfTarget={totals.calories.percentageOfTarget}
          barClass={calBar}
        />
        <MacroTile
          icon={<Wheat className="h-4 w-4 text-warning" />}
          label="Carbohidratos"
          value={totals.carbohydrates.current}
          unit="g"
          target={`${client.targetMacros.carbohydrates} g`}
          badge={`${totals.carbohydrates.distributionPct}%`}
          percentOfTarget={totals.carbohydrates.percentageOfTarget}
          barClass="bg-warning"
        />
        <MacroTile
          icon={<Drumstick className="h-4 w-4 text-danger" />}
          label="Proteínas"
          value={totals.proteins.current}
          unit="g"
          target={`${client.targetMacros.proteins} g`}
          badge={`${totals.proteins.distributionPct}%`}
          percentOfTarget={totals.proteins.percentageOfTarget}
          barClass="bg-danger"
        />
        <MacroTile
          icon={<Droplets className="h-4 w-4 text-info" />}
          label="Lípidos"
          value={totals.lipids.current}
          unit="g"
          target={`${client.targetMacros.lipids} g`}
          badge={`${totals.lipids.distributionPct}%`}
          percentOfTarget={totals.lipids.percentageOfTarget}
          barClass="bg-info"
        />
      </div>
    </Card>
  );
}
