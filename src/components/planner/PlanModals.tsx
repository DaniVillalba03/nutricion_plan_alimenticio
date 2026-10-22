'use client';

import React, { useState } from 'react';
import type { Client, MealPlan, PlanVersion } from '@/types/nutrition';
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
      description={`Creará la versión ${nextVersion.toFixed(1)} y archivará la actual en el historial.`}
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
        <Field label="Nota clínica de evolución">
          {(p) => (
            <Textarea
              {...p}
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Ajuste de carbohidratos en merienda para mejorar energía en entrenamiento."
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
        </div>

        {!plan.versions || plan.versions.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            No hay versiones anteriores archivadas. Guarda una nueva versión al modificar el plan.
          </p>
        ) : (
          plan.versions.map((ver) => (
            <div key={ver.id} className="space-y-1.5 rounded-xl border border-border bg-surface-muted/50 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Versión {ver.versionNumber.toFixed(1)}</span>
                <span className="text-xs text-muted">
                  {new Date(ver.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' })}
                </span>
              </div>
              {ver.changeNote && <p className="text-xs italic text-muted">&quot;{ver.changeNote}&quot;</p>}
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
