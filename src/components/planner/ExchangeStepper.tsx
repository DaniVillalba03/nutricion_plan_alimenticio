'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { formatFriendlyFraction, QUICK_EXCHANGE_PRESETS } from '@/core/exchange-engine';
import { Popover } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

interface ExchangeStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Nombre del grupo, para los lectores de pantalla. */
  label: string;
}

const STEP = 0.25;
const MIN = 0.25;
const MAX = 10;

const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n * 100) / 100));

/**
 * Cantidad de intercambios: − / valor / +, con saltos de ¼. Al pulsar el valor se abre
 * una lista de porciones habituales (¼, ½, ¾, 1, 1½, 2...), en vez de repetir seis botones por fila.
 */
export function ExchangeStepper({ value, onChange, label }: ExchangeStepperProps) {
  const button =
    'inline-flex h-8 w-8 items-center justify-center text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-35 disabled:pointer-events-none';

  return (
    <div
      role="group"
      aria-label={`Intercambios de ${label}`}
      className="inline-flex items-center overflow-hidden rounded-lg border border-border-strong bg-surface"
    >
      <button
        type="button"
        className={button}
        onClick={() => onChange(clamp(value - STEP))}
        disabled={value <= MIN}
        aria-label="Quitar un cuarto de intercambio"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <Popover
        align="left"
        panelClassName="w-44 p-2"
        triggerLabel="Elegir cantidad de intercambios"
        triggerClassName="h-8 min-w-12 border-x border-border px-2 text-center text-[15px] font-medium tabular-nums text-foreground transition-colors hover:bg-surface-muted"
        trigger={formatFriendlyFraction(value)}
      >
        {(close) => (
          <div className="grid grid-cols-3 gap-1">
            {QUICK_EXCHANGE_PRESETS.map((preset) => {
              const current = Math.abs(value - preset) < 0.01;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={current}
                  onClick={() => {
                    onChange(preset);
                    close();
                  }}
                  className={cn(
                    'h-9 rounded-md text-[15px] tabular-nums transition-colors',
                    current ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-surface-muted'
                  )}
                >
                  {formatFriendlyFraction(preset)}
                </button>
              );
            })}
          </div>
        )}
      </Popover>

      <button
        type="button"
        className={button}
        onClick={() => onChange(clamp(value + STEP))}
        disabled={value >= MAX}
        aria-label="Añadir un cuarto de intercambio"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
