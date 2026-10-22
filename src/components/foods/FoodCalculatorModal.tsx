'use client';

import React, { useMemo, useState } from 'react';
import { Flame, Wheat, Drumstick, Droplets, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import { MOCK_EXCHANGE_GROUPS } from '@/lib/mock-data';
import { Food, FoodState, GroupSuggestionResult } from '@/types/nutrition';
import { suggestExchangeFromNutrients100g, FoodInputSchema } from '@/core/validators';
import { newId } from '@/lib/utils';
import { Modal, Button, Field, Input, Select, Badge } from '@/components/ui';

interface FoodCalculatorModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (food: Food, groupName: string) => void;
}

const INITIAL_FORM = {
  name: '',
  kcal100g: 220,
  cho100g: 45,
  pro100g: 4,
  lip100g: 2,
  state: 'cocido' as FoodState,
  householdQty: 1,
  householdUnit: 'unidad',
  brand: '',
  isParaguayanMarked: true,
};

/** Calculadora por 100 g: sugiere el grupo de intercambio y crea un alimento nuevo. */
export function FoodCalculatorModal({ open, onClose, onCreate }: FoodCalculatorModalProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const suggestion: GroupSuggestionResult = useMemo(
    () =>
      suggestExchangeFromNutrients100g(
        Number(form.kcal100g) || 0,
        Number(form.cho100g) || 0,
        Number(form.pro100g) || 0,
        Number(form.lip100g) || 0,
        MOCK_EXCHANGE_GROUPS
      ),
    [form.kcal100g, form.cho100g, form.pro100g, form.lip100g]
  );

  const num = (key: 'kcal100g' | 'cho100g' | 'pro100g' | 'lip100g' | 'householdQty') => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => setForm((prev) => ({ ...prev, [key]: Number(e.target.value) }));

  const close = () => {
    setFormError(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) {
      setFormError('Por favor ingresa el nombre del alimento.');
      return;
    }

    const grams = suggestion.baseGramsFor1Exchange || 100;
    const newFood: Food = {
      id: newId('food-custom'),
      name: form.name.trim(),
      groupId: suggestion.suggestedGroup.id,
      state: form.state,
      baseGrams: grams,
      householdQty: Number(form.householdQty) || 1,
      householdUnit: form.householdUnit.trim(),
      portionDescription: `${form.householdQty} ${form.householdUnit} (${grams}g)`,
      brand: form.brand.trim() || undefined,
      isParaguayanMarked: form.isParaguayanMarked,
      countryOrigin: 'PY',
      source: 'Cálculo 100g (Nutricionista)',
      aliases: [],
      notes: `Sugerido por relación de macros (${suggestion.macroProportions.choPct}% CHO, ${suggestion.macroProportions.proPct}% PRO, ${suggestion.macroProportions.lipPct}% LIP)`,
    };

    const validation = FoodInputSchema.safeParse(newFood);
    if (!validation.success) {
      setFormError(validation.error.issues[0]?.message || 'Error de validación');
      return;
    }

    onCreate(newFood, suggestion.suggestedGroup.name);
    setForm(INITIAL_FORM);
  };

  const { atwaterValidation: atwater, macroProportions: macros } = suggestion;

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title="Calculadora nutricional por 100 g"
      description="Ingresa los nutrientes por 100 g y el motor sugerirá el grupo de intercambio óptimo."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="food-calculator-form">
            <Plus className="h-4 w-4" />
            Agregar al catálogo
          </Button>
        </>
      }
    >
      <form id="food-calculator-form" onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-xs font-semibold text-danger-soft-foreground">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre del alimento *" className="sm:col-span-2">
            {(p) => (
              <Input
                {...p}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej. Galletitas de arroz con sésamo, Queso magro criollo..."
              />
            )}
          </Field>
          <Field label="Marca comercial (opcional)">
            {(p) => (
              <Input {...p} value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ej. Bimbo, La Palmera..." />
            )}
          </Field>
          <Field label="Estado de preparación">
            {(p) => (
              <Select {...p} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value as FoodState })}>
                <option value="cocido">Cocido / listo para consumo</option>
                <option value="crudo">Crudo</option>
                <option value="no_aplica">No aplica</option>
              </Select>
            )}
          </Field>
        </div>

        <div className="space-y-3 rounded-xl bg-surface-muted/60 p-4">
          <h3 className="font-display text-lg font-medium text-foreground">Información nutricional por 100 g</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Kcal">
              {(p) => <Input {...p} type="number" min="0" step="1" value={form.kcal100g} onChange={num('kcal100g')} className="text-center font-semibold" />}
            </Field>
            <Field label="CHO (g)">
              {(p) => <Input {...p} type="number" min="0" step="0.1" value={form.cho100g} onChange={num('cho100g')} className="text-center font-semibold" />}
            </Field>
            <Field label="PRO (g)">
              {(p) => <Input {...p} type="number" min="0" step="0.1" value={form.pro100g} onChange={num('pro100g')} className="text-center font-semibold" />}
            </Field>
            <Field label="LIP (g)">
              {(p) => <Input {...p} type="number" min="0" step="0.1" value={form.lip100g} onChange={num('lip100g')} className="text-center font-semibold" />}
            </Field>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
            <span className="text-muted">
              Fórmula 4/4/9: <strong className="text-foreground">{atwater.calculatedKcal} kcal</strong>
            </span>
            {atwater.isValid ? (
              <Badge tone="primary">
                <CheckCircle2 className="h-3.5 w-3.5" /> Consistente ({atwater.diffPercent}% dif.)
              </Badge>
            ) : (
              <Badge tone="warning">
                <AlertTriangle className="h-3.5 w-3.5" /> Discrepancia {atwater.diffPercent}%
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-primary-soft p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium text-primary-soft-foreground">Grupo sugerido</p>
              <h4 className="text-lg font-bold text-foreground">{suggestion.suggestedGroup.name}</h4>
            </div>
            <Badge tone="primary">Confianza {suggestion.confidence}</Badge>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Distribución calórica</span>
              <span>
                {macros.choPct}% CHO · {macros.proPct}% PRO · {macros.lipPct}% LIP
              </span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-border">
              <div style={{ width: `${macros.choPct}%` }} className="h-full bg-warning" />
              <div style={{ width: `${macros.proPct}%` }} className="h-full bg-danger" />
              <div style={{ width: `${macros.lipPct}%` }} className="h-full bg-info" />
            </div>
            <div className="flex gap-3 text-xs text-muted">
              <span className="flex items-center gap-1"><Wheat className="h-3 w-3 text-warning" /> CHO</span>
              <span className="flex items-center gap-1"><Drumstick className="h-3 w-3 text-danger" /> PRO</span>
              <span className="flex items-center gap-1"><Droplets className="h-3 w-3 text-info" /> LIP</span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-3">
            <div>
              <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                <Flame className="h-3.5 w-3.5 text-warning" /> Gramos para 1 intercambio
              </p>
              <p className="text-xs text-muted">
                Basado en {suggestion.suggestedGroup.referenceMacros.calories} kcal de {suggestion.suggestedGroup.shortName}
              </p>
            </div>
            <span className="text-xl font-bold text-primary">{suggestion.baseGramsFor1Exchange}g</span>
          </div>

          <p className="text-xs italic text-muted">{suggestion.reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad casera estimada">
            {(p) => <Input {...p} type="number" min="0.25" step="0.25" value={form.householdQty} onChange={num('householdQty')} />}
          </Field>
          <Field label="Unidad casera">
            {(p) => (
              <Input {...p} value={form.householdUnit} onChange={(e) => setForm({ ...form, householdUnit: e.target.value })} placeholder="unidad, rebanada, taza, cda" />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
