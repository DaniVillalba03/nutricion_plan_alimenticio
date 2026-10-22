'use client';

import React, { useMemo, useState } from 'react';
import { ChevronsUpDown, Check, Search, UserPlus } from 'lucide-react';
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

/** Selector de paciente con búsqueda; escala a listas largas. */
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
      triggerClassName="inline-flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-muted"
      trigger={
        <>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-sm font-bold text-primary-soft-foreground">
            {activeClient.fullName.replace(/^Lic\.\s*/, '').charAt(0)}
          </span>
          <span className="min-w-0">
            <span className="block max-w-56 truncate text-sm font-bold text-foreground">{activeClient.fullName}</span>
            <span className="block text-xs text-muted">
              {activeClient.age} años · {activeClient.targetCalories} kcal
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 text-subtle" />
        </>
      }
    >
      {(close) => (
        <>
          <div className="relative p-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar paciente..."
              aria-label="Buscar paciente"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-ring focus:outline-none"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">Sin resultados</p>}
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
                  'flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-muted',
                  c.id === activeClient.id && 'bg-primary-soft'
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{c.fullName}</span>
                  <span className="block text-xs text-muted">{c.targetCalories} kcal</span>
                </span>
                {c.id === activeClient.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
          <div className="border-t border-border pt-1.5">
            <button
              type="button"
              onClick={() => {
                close();
                onCreate();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
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
