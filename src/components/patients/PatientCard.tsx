import React from 'react';
import Link from 'next/link';
import { Flame, Wheat, Drumstick, Droplets, ShieldBan, Activity, ArrowRight } from 'lucide-react';
import type { Client } from '@/types/nutrition';
import { Badge, Card, buttonClasses } from '@/components/ui';

interface PatientCardProps {
  client: Client;
  onOpenPlan: (clientId: string) => void;
}

function Target({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-muted/50 p-2.5 text-center">
      <div className="mb-1 flex justify-center">{icon}</div>
      <div className="text-sm font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

export function PatientCard({ client, onOpenPlan }: PatientCardProps) {
  const initial = client.fullName.replace(/^Lic\.\s*/, '').charAt(0).toUpperCase();

  return (
    <Card className="flex flex-col justify-between gap-5 p-5">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-lg font-bold text-primary-soft-foreground">
              {initial}
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{client.fullName}</h3>
              <p className="text-xs text-muted">
                {client.age} años · {client.gender}
                {client.weightKg ? ` · ${client.weightKg} kg` : ''}
                {client.heightCm ? ` · ${client.heightCm} cm` : ''}
              </p>
            </div>
          </div>
          <Badge tone="primary">Activo</Badge>
        </div>

        {client.activityLevel && (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Activity className="h-4 w-4 shrink-0 text-primary" />
            <span>
              Actividad: <strong className="text-foreground">{client.activityLevel}</strong>
            </span>
          </p>
        )}

        {client.exclusions.length > 0 && (
          <div className="space-y-2 rounded-xl bg-danger-soft p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-danger-soft-foreground">
              <ShieldBan className="h-4 w-4" />
              Restricciones clínicas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {client.exclusions.map((exclusion) => (
                <Badge key={exclusion} tone="danger" className="bg-surface/60">
                  Sin {exclusion}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Objetivos nutricionales</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Target icon={<Flame className="h-4 w-4 text-warning" />} value={`${client.targetCalories}`} label="kcal" />
            <Target
              icon={<Wheat className="h-4 w-4 text-warning" />}
              value={`${client.targetMacros.carbohydrates}g`}
              label={`${client.macroDistributionPct.carbohydrates}% CHO`}
            />
            <Target
              icon={<Drumstick className="h-4 w-4 text-danger" />}
              value={`${client.targetMacros.proteins}g`}
              label={`${client.macroDistributionPct.proteins}% PRO`}
            />
            <Target
              icon={<Droplets className="h-4 w-4 text-info" />}
              value={`${client.targetMacros.lipids}g`}
              label={`${client.macroDistributionPct.lipids}% LIP`}
            />
          </div>
        </div>

        {client.notes && (
          <div className="rounded-xl border border-border bg-surface-muted/50 p-3 text-xs text-muted">
            <span className="mb-0.5 block font-semibold text-foreground">Notas clínicas</span>
            {client.notes}
          </div>
        )}
      </div>

      <Link
        href="/dashboard"
        onClick={() => onOpenPlan(client.id)}
        className={buttonClasses('accent', 'md') + ' w-full'}
      >
        Construir plan de intercambios
        <ArrowRight className="h-4 w-4" />
      </Link>
    </Card>
  );
}
