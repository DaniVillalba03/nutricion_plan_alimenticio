'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ClientInputSchema } from '@/core/validators';
import type { Client } from '@/types/nutrition';
import { Modal, Button, Field, Input, Select, Textarea } from '@/components/ui';
import { buildClientFromInput, macroGramsFromSplit, type ClientInput } from './build-client';

interface NewPatientModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (client: Client, input: ClientInput) => void;
}

const ACTIVITY_LEVELS = [
  'Sedentario',
  'Ligero (1-2x semana)',
  'Moderado (3-4x semana)',
  'Intenso (5x semana o más)',
];

const COMMON_EXCLUSIONS = ['Lactosa', 'Gluten', 'Carne roja', 'Mariscos', 'Frutos secos', 'Huevo'];

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  age: '',
  gender: 'femenino',
  weightKg: '',
  heightCm: '',
  activityLevel: ACTIVITY_LEVELS[1],
  targetKcal: '',
  pctCho: '50',
  pctPro: '20',
  pctLip: '30',
  notes: '',
};

type FormState = typeof EMPTY_FORM;
type Errors = Partial<Record<keyof FormState | 'macros', string>>;

export function NewPatientModal({ open, onClose, onCreate }: NewPatientModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [customExclusion, setCustomExclusion] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const split = {
    carbohydrates: Number(form.pctCho) || 0,
    proteins: Number(form.pctPro) || 0,
    lipids: Number(form.pctLip) || 0,
  };
  const pctTotal = split.carbohydrates + split.proteins + split.lipids;
  const kcal = Number(form.targetKcal) || 0;
  const grams = macroGramsFromSplit(kcal, split);

  const reset = () => {
    setForm(EMPTY_FORM);
    setExclusions([]);
    setCustomExclusion('');
    setErrors({});
  };

  const close = () => {
    reset();
    onClose();
  };

  const toggleExclusion = (name: string) =>
    setExclusions((prev) => (prev.includes(name) ? prev.filter((e) => e !== name) : [...prev, name]));

  const addCustomExclusion = () => {
    const value = customExclusion.trim();
    if (value && !exclusions.some((e) => e.toLowerCase() === value.toLowerCase())) {
      setExclusions((prev) => [...prev, value]);
    }
    setCustomExclusion('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Errors = {};

    if (pctTotal !== 100) {
      nextErrors.macros = `El reparto debe sumar 100% (actual: ${pctTotal}%)`;
    }

    const parsed = ClientInputSchema.safeParse({
      fullName: form.fullName,
      email: form.email,
      phone: form.phone || undefined,
      age: form.age,
      gender: form.gender,
      weightKg: form.weightKg,
      heightCm: form.heightCm || undefined,
      activityLevel: form.activityLevel,
      targetKcal: form.targetKcal,
      targetChoG: grams.carbohydrates,
      targetProG: grams.proteins,
      targetLipG: grams.lipids,
      notes: form.notes || undefined,
      exclusions,
    });

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormState;
        nextErrors[key] ??= issue.message;
      }
    }

    if (Object.keys(nextErrors).length > 0 || !parsed.success) {
      setErrors(nextErrors);
      return;
    }

    onCreate(buildClientFromInput(parsed.data, split), parsed.data);
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Nuevo paciente"
      description="Completa el perfil clínico. Las metas de macronutrientes se calculan desde las calorías y el reparto."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="new-patient-form">
            Crear paciente
          </Button>
        </>
      }
    >
      <form id="new-patient-form" onSubmit={handleSubmit} noValidate className="space-y-6">
        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-subtle">Datos personales</h3>
          <Field label="Nombre completo" error={errors.fullName}>
            {(p) => (
              <Input {...p} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Ej. Juan Pérez" />
            )}
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Correo (opcional)" error={errors.email}>
              {(p) => <Input {...p} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />}
            </Field>
            <Field label="Teléfono (opcional)">
              {(p) => <Input {...p} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+595 9.." />}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Edad" error={errors.age}>
              {(p) => <Input {...p} type="number" inputMode="numeric" min={1} value={form.age} onChange={(e) => set('age', e.target.value)} />}
            </Field>
            <Field label="Sexo">
              {(p) => (
                <Select {...p} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option value="femenino">Femenino</option>
                  <option value="masculino">Masculino</option>
                </Select>
              )}
            </Field>
            <Field label="Peso (kg)" error={errors.weightKg}>
              {(p) => <Input {...p} type="number" inputMode="decimal" step="0.1" value={form.weightKg} onChange={(e) => set('weightKg', e.target.value)} />}
            </Field>
            <Field label="Talla (cm)" error={errors.heightCm}>
              {(p) => <Input {...p} type="number" inputMode="numeric" value={form.heightCm} onChange={(e) => set('heightCm', e.target.value)} />}
            </Field>
          </div>
          <Field label="Nivel de actividad">
            {(p) => (
              <Select {...p} value={form.activityLevel} onChange={(e) => set('activityLevel', e.target.value)}>
                {ACTIVITY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-subtle">Metas nutricionales</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Calorías (kcal)" error={errors.targetKcal} className="col-span-2 sm:col-span-1">
              {(p) => <Input {...p} type="number" inputMode="numeric" value={form.targetKcal} onChange={(e) => set('targetKcal', e.target.value)} />}
            </Field>
            <Field label="% CHO">
              {(p) => <Input {...p} type="number" inputMode="numeric" min={0} max={100} value={form.pctCho} onChange={(e) => set('pctCho', e.target.value)} />}
            </Field>
            <Field label="% PRO">
              {(p) => <Input {...p} type="number" inputMode="numeric" min={0} max={100} value={form.pctPro} onChange={(e) => set('pctPro', e.target.value)} />}
            </Field>
            <Field label="% LIP">
              {(p) => <Input {...p} type="number" inputMode="numeric" min={0} max={100} value={form.pctLip} onChange={(e) => set('pctLip', e.target.value)} />}
            </Field>
          </div>
          <div
            className={`rounded-xl border px-3 py-2 text-xs ${
              errors.macros || pctTotal !== 100
                ? 'border-danger/40 bg-danger-soft text-danger-soft-foreground'
                : 'border-border bg-surface-muted text-muted'
            }`}
          >
            {errors.macros ?? (
              <>
                Total {pctTotal}% → <strong className="text-foreground">{grams.carbohydrates} g</strong> CHO ·{' '}
                <strong className="text-foreground">{grams.proteins} g</strong> PRO ·{' '}
                <strong className="text-foreground">{grams.lipids} g</strong> LIP
              </>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-subtle">Restricciones y notas</h3>
          <div className="flex flex-wrap gap-1.5">
            {[...COMMON_EXCLUSIONS, ...exclusions.filter((e) => !COMMON_EXCLUSIONS.includes(e))].map((name) => {
              const active = exclusions.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleExclusion(name)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-danger/40 bg-danger-soft text-danger-soft-foreground'
                      : 'border-border text-muted hover:bg-surface-muted'
                  }`}
                >
                  {active && <X className="h-3 w-3" />}
                  Sin {name}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Input
              value={customExclusion}
              onChange={(e) => setCustomExclusion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomExclusion();
                }
              }}
              placeholder="Otra restricción..."
              aria-label="Otra restricción"
            />
            <Button onClick={addCustomExclusion}>Añadir</Button>
          </div>
          <Field label="Notas clínicas (opcional)">
            {(p) => <Textarea {...p} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />}
          </Field>
        </section>
      </form>
    </Modal>
  );
}
