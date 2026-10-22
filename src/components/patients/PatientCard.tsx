import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { Client } from '@/types/nutrition';
import { buttonClasses } from '@/components/ui';
import { cn } from '@/lib/utils';

interface PatientCardProps {
  client: Client;
  onOpenPlan: (clientId: string) => void;
}

const nf = new Intl.NumberFormat('es-PY');

/** Una fila de la lista de pacientes: datos a la izquierda, metas y acción a la derecha. */
export function PatientCard({ client, onOpenPlan }: PatientCardProps) {
  const details = [
    `${client.age} años`,
    client.gender.charAt(0).toUpperCase() + client.gender.slice(1),
    client.weightKg ? `${client.weightKg} kg` : null,
    client.heightCm ? `${client.heightCm} cm` : null,
  ].filter(Boolean);

  const initials = client.fullName
    .replace(/^(lic|licda|ing|dr|dra)\.?\s+/i, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <li className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="flex min-w-0 items-start gap-4">
        <span
          className="mono-label flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
        <h3 className="text-xl font-bold tracking-[-0.03em] text-foreground">{client.fullName}</h3>
        <p className="mt-0.5 text-sm text-muted">{details.join(' · ')}</p>
        {client.activityLevel && <p className="mt-0.5 text-sm text-muted">{client.activityLevel}</p>}
        {client.exclusions.length > 0 && (
          <p className="mt-1.5 text-sm text-danger">Sin {client.exclusions.map((e) => e.toLowerCase()).join(', ')}</p>
        )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        <dl className="grid grid-cols-4 gap-x-5 text-right tabular-nums">
          <Stat label="kcal" value={nf.format(client.targetCalories)} strong />
          <Stat label="CHO" value={`${client.targetMacros.carbohydrates} g`} />
          <Stat label="PRO" value={`${client.targetMacros.proteins} g`} />
          <Stat label="LIP" value={`${client.targetMacros.lipids} g`} />
        </dl>

        <Link
          href="/dashboard"
          onClick={() => onOpenPlan(client.id)}
          className={cn(buttonClasses('secondary', 'md'), 'shrink-0')}
        >
          Abrir plan
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </li>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dd className={cn('text-[15px]', strong ? 'font-medium text-foreground' : 'text-foreground')}>{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}
