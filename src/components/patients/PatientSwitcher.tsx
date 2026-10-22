'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, Check, Search, UserPlus } from 'lucide-react';
import type { Client } from '@/types/nutrition';
import { Popover } from '@/components/ui/Popover';
import { cn } from '@/lib/utils';

interface PatientSwitcherProps {
  clients: Client[];
  activeClient: Client;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** El nombre del paciente es el título de la página; al pulsarlo se cambia de paciente. */
export function PatientSwitcher({ clients, activeClient, onSelect, onCreate }: PatientSwitcherProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return q ? clients.filter((c) => normalize(c.fullName).includes(q)) : clients;
  }, [clients, query]);

  return (
    <Popover
      align="left"
      panelClassName="w-80"
      triggerLabel="Cambiar paciente"
      triggerClassName="group -ml-2 inline-flex max-w-full items-center gap-2 rounded-lg px-2 py-0.5 text-left transition-colors hover:bg-surface-muted"
      trigger={
        <>
          <span className="truncate text-[34px] font-bold leading-[1.04] tracking-[-0.045em] text-foreground sm:text-[44px]">
            {activeClient.fullName}
          </span>
          <ChevronDown className="mt-2 h-6 w-6 shrink-0 text-subtle transition-colors group-hover:text-foreground" />
        </>
      }
    >
      {(close) => (
        <>
          <div className="relative p-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar paciente"
              aria-label="Buscar paciente"
              className="h-9 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-ring focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-4 text-center text-sm text-muted">Sin resultados</p>}
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onSelect(c.id);
                  setQuery('');
                  close();
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-muted',
                  c.id === activeClient.id && 'bg-surface-muted'
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{c.fullName}</span>
                  <span className="block text-[13px] tabular-nums text-muted">{c.targetCalories} kcal</span>
                </span>
                {c.id === activeClient.id && <Check className="h-4 w-4 text-foreground" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border pt-1">
            <button
              type="button"
              onClick={() => {
                close();
                onCreate();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              <UserPlus className="h-4 w-4" />
              Nuevo paciente
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}
