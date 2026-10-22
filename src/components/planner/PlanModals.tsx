'use client';

import React, { useState } from 'react';
import type { Client, MealPlan, MealPlanMeal, PlanVersion } from '@/types/nutrition';
import { MOCK_EXCHANGE_GROUPS } from '@/lib/mock-data';
import { diffMeals, type PlanChange } from '@/core/plan-diff';
import { formatFriendlyFraction } from '@/core/exchange-engine';
import { Modal, Button, Field, Input, Select, Textarea, Badge } from '@/components/ui';

/* ---------------------------------------------------------------- Plantilla */

interface SaveTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function SaveTemplateModal({ open, onClose, onSave }: SaveTemplateModalProps) {
  const [name, setName] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
    setName('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Guardar como plantilla"
      description="Guarda la distribución actual de comidas e intercambios para reutilizarla con otros pacientes."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="save-template-form" disabled={!name.trim()}>
            Guardar plantilla
          </Button>
        </>
      }
    >
      <form id="save-template-form" onSubmit={submit}>
        <Field label="Nombre de la plantilla">
          {(p) => (
            <Input {...p} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Plan Deportivo 2200 kcal" />
          )}
        </Field>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------- Nueva versión */

interface NewVersionModalProps {
  open: boolean;
  onClose: () => void;
  nextVersion: number;
  onSave: (note: string) => void;
}

export function NewVersionModal({ open, onClose, nextVersion, onSave }: NewVersionModalProps) {
  const [note, setNote] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(note);
    setNote('');
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Guardar nueva versión"
      description={`Archiva el plan actual en el historial y sigues editando la versión ${nextVersion.toFixed(1)}. Úsalo cuando vayas a cambiar el plan por una razón clínica: después podrás ver qué cambió y volver atrás.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="new-version-form">
            Crear versión {nextVersion.toFixed(1)}
          </Button>
        </>
      }
    >
      <form id="new-version-form" onSubmit={submit}>
        <Field label={`¿Por qué se crea la versión ${nextVersion.toFixed(1)}?`}>
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Subí las calorías a 1.800 por el aumento de entrenamiento."
            />
          )}
        </Field>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Duplicar */

interface DuplicatePlanModalProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  currentClientId: string;
  onDuplicate: (targetClientId: string) => void;
}

export function DuplicatePlanModal({ open, onClose, clients, currentClientId, onDuplicate }: DuplicatePlanModalProps) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const defaultTarget = clients.find((c) => c.id !== currentClientId)?.id ?? currentClientId;
  const targetId = chosenId ?? defaultTarget;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Duplicar plan"
      description="Copia todas las comidas e intercambios actuales al perfil de otro paciente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onDuplicate(targetId);
              setChosenId(null);
            }}
          >
            Confirmar y duplicar
          </Button>
        </>
      }
    >
      <Field label="Paciente destino">
        {(p) => (
          <Select {...p} value={targetId} onChange={(e) => setChosenId(e.target.value)}>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.targetCalories} kcal)
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Historial */

interface VersionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  plan: MealPlan;
  currentKcal: number;
  onRestore: (version: PlanVersion) => void;
}

const GROUP_NAME = new Map(MOCK_EXCHANGE_GROUPS.map((g) => [g.id, g.shortName]));
const qty = (n: number) => formatFriendlyFraction(n);

function describeChange(c: PlanChange): { sign: '+' | '−' | '~'; text: string } {
  const group = 'groupId' in c ? (GROUP_NAME.get(c.groupId) ?? c.groupId) : '';
  switch (c.kind) {
    case 'meal-added':
      return { sign: '+', text: `Comida nueva: ${c.meal}` };
    case 'meal-removed':
      return { sign: '−', text: `Comida quitada: ${c.meal}` };
    case 'item-added':
      return { sign: '+', text: `${c.meal}: ${group} ${qty(c.to)}` };
    case 'item-removed':
      return { sign: '−', text: `${c.meal}: ${group} ${qty(c.from)}` };
    case 'item-changed':
      return { sign: '~', text: `${c.meal}: ${group} ${qty(c.from)} → ${qty(c.to)}` };
  }
}

/** Lista breve de lo que cambió entre dos versiones (vacía si el contenido es igual). */
function ChangeList({ before, after }: { before: MealPlanMeal[]; after: MealPlanMeal[] }) {
  const changes = diffMeals(before, after);
  if (changes.length === 0) {
    return <p className="text-xs text-subtle">Sin cambios en las comidas respecto a la versión anterior.</p>;
  }
  return (
    <ul className="space-y-0.5 text-xs text-muted" aria-label="Cambios respecto a la versión anterior">
      {changes.slice(0, 8).map((c, i) => {
        const { sign, text } = describeChange(c);
        return (
          <li key={i} className="flex gap-1.5">
            <span className="w-3 shrink-0 text-center font-medium text-foreground" aria-hidden="true">
              {sign}
            </span>
            <span>{text}</span>
          </li>
        );
      })}
      {changes.length > 8 && <li className="pl-[18px] text-subtle">y {changes.length - 8} cambios más</li>}
    </ul>
  );
}

export function VersionHistoryModal({ open, onClose, plan, currentKcal, onRestore }: VersionHistoryModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Historial de versiones"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-primary/40 bg-primary-soft p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-primary-soft-foreground">
              Versión {plan.versionNumber?.toFixed(1) || '1.0'}
            </span>
            <Badge tone="primary">Vigente</Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {plan.meals.length} comidas · {Math.round(currentKcal)} kcal
          </p>
          {plan.versionNote && <p className="mt-1.5 text-xs italic text-muted">&quot;{plan.versionNote}&quot;</p>}
          {plan.versions && plan.versions.length > 0 && (
            <div className="mt-2.5 border-t border-primary/20 pt-2.5">
              <ChangeList before={plan.versions[0].meals} after={plan.meals} />
            </div>
          )}
        </div>

        {!plan.versions || plan.versions.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            No hay versiones anteriores archivadas. Guarda una nueva versión al modificar el plan.
          </p>
        ) : (
          plan.versions.map((ver, idx) => (
            <div key={ver.id} className="space-y-1.5 rounded-xl border border-border bg-surface-muted/50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Versión {ver.versionNumber.toFixed(1)}</span>
                <span className="text-xs text-muted">
                  {new Date(ver.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}
                </span>
              </div>
              {ver.changeNote && <p className="text-xs italic text-muted">&quot;{ver.changeNote}&quot;</p>}
              {plan.versions && plan.versions[idx + 1] && (
                <ChangeList before={plan.versions[idx + 1].meals} after={ver.meals} />
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-subtle">{ver.meals.length} comidas guardadas</span>
                <Button size="sm" variant="primary" onClick={() => onRestore(ver)}>
                  Restaurar
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
