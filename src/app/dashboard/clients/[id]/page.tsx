'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import type { AdherenceDay, Measurement } from '@/types/nutrition';
import { MeasurementInputSchema } from '@/core/validators';
import { adherenceAverage, weightStats } from '@/core/progress';
import { todayInParaguay } from '@/core/portal-progress';
import { addMeasurementAction, deleteMeasurementAction, getAdherenceHistoryAction, getMeasurementsAction } from '@/actions/progress';
import { usePatients } from '@/components/patients/PatientsProvider';
import { AdherenceBars, WeightChart } from '@/components/progress/ProgressCharts';
import { Button, Card, Field, Input, Modal, PageHeader, SectionTitle, Textarea, buttonClasses, useToast } from '@/components/ui';
import { redirectIfSessionExpired } from '@/lib/session';
import { cn } from '@/lib/utils';

const dateFmt = new Intl.DateTimeFormat('es-PY', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtDate = (day: string) => dateFmt.format(new Date(`${day}T00:00:00Z`));
const num = (n: number) => n.toLocaleString('es-PY', { maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`;

const EMPTY_FORM = { measuredOn: '', weightKg: '', bodyFatPct: '', waistCm: '', notes: '' };
type FormState = typeof EMPTY_FORM;

/** Seguimiento de un paciente: evolución del peso, controles registrados y adherencia al plan. */
export default function PatientProgressPage() {
  const { id } = useParams<{ id: string }>();
  const { clients, loading, updateClient, selectClient } = usePatients();
  const { toast } = useToast();
  const client = clients.find((c) => c.id === id);

  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);
  const [adherence, setAdherence] = useState<AdherenceDay[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Measurement | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMeasurementsAction(id)
      .then((res) => {
        if (cancelled) return;
        if (!res.success) redirectIfSessionExpired(res.error);
        setMeasurements(res.measurements);
      })
      .catch(() => {
        if (!cancelled) setMeasurements([]);
      });
    getAdherenceHistoryAction(id)
      .then((res) => {
        if (!cancelled) setAdherence(res.series);
      })
      .catch(() => {
        // Sin conexión: el gráfico queda vacío
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const list = useMemo(() => measurements ?? [], [measurements]);
  const stats = useMemo(() => weightStats(list, client?.heightCm), [list, client?.heightCm]);
  const average = useMemo(() => adherenceAverage(adherence), [adherence]);
  const table = useMemo(() => [...list].reverse(), [list]);

  /** La ficha del paciente muestra siempre el peso del control más reciente. */
  const syncClientWeight = (next: Measurement[]) => {
    const latest = [...next].sort((a, b) => a.measuredOn.localeCompare(b.measuredOn)).at(-1);
    if (latest) updateClient(id, { weightKg: latest.weightKg });
  };

  const openForm = () => {
    setForm({ ...EMPTY_FORM, measuredOn: todayInParaguay(), weightKg: stats ? String(stats.latest) : '' });
    setFormError(null);
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = MeasurementInputSchema.safeParse({
      measuredOn: form.measuredOn || undefined,
      weightKg: form.weightKg,
      bodyFatPct: form.bodyFatPct || undefined,
      waistCm: form.waistCm || undefined,
      notes: form.notes || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Revisa los datos');
      return;
    }

    setSaving(true);
    try {
      const res = await addMeasurementAction(id, parsed.data);
      if (!res.success || !res.measurement) {
        redirectIfSessionExpired(res.error);
        setFormError(res.error ?? 'No se pudo guardar el control');
        return;
      }
      const saved = res.measurement;
      // Un control del mismo día reemplaza al anterior
      const next = [...list.filter((m) => m.measuredOn !== saved.measuredOn), saved].sort((a, b) =>
        a.measuredOn.localeCompare(b.measuredOn)
      );
      setMeasurements(next);
      syncClientWeight(next);
      setFormOpen(false);
      toast('Control registrado');
    } catch {
      setFormError('No se pudo guardar el control. Revisa tu conexión.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      const res = await deleteMeasurementAction(toDelete.id);
      if (!res.success) {
        redirectIfSessionExpired(res.error);
        toast(`No se pudo eliminar: ${res.error}`);
        return;
      }
      const next = list.filter((m) => m.id !== toDelete.id);
      setMeasurements(next);
      syncClientWeight(next);
      setToDelete(null);
      toast('Control eliminado');
    } catch {
      toast('No se pudo eliminar. Revisa tu conexión.');
    } finally {
      setSaving(false);
    }
  };

  if (!client) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/clients" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Pacientes
        </Link>
        <p className="text-[15px] text-muted">{loading ? 'Cargando paciente…' : 'No encontramos a este paciente.'}</p>
      </div>
    );
  }

  const setField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-10">
      <div>
        <Link href="/dashboard/clients" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Pacientes
        </Link>
        <PageHeader
          eyebrow="Seguimiento"
          title={client.fullName}
          description="Evolución del peso, controles registrados y cuánto del plan completa el paciente."
          actions={
            <>
              <Link href="/dashboard" onClick={() => selectClient(id)} className={buttonClasses('secondary', 'md')}>
                Abrir plan
              </Link>
              <Button variant="primary" onClick={openForm}>
                <Plus className="h-4 w-4" />
                Registrar control
              </Button>
            </>
          }
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Peso actual" value={stats ? num(stats.latest) : '—'} unit="kg" />
        <Stat
          label="Cambio total"
          value={stats && stats.count > 1 ? signed(stats.change) : '—'}
          unit="kg"
          hint={stats && stats.count > 1 ? `${signed(stats.changePct)}% desde el primer control` : undefined}
        />
        <Stat label="IMC" value={stats?.bmi ? num(stats.bmi) : '—'} hint={stats?.bmi ? undefined : 'Falta la talla'} />
        <Stat label="Adherencia" value={average === null ? '—' : String(average)} unit={average === null ? undefined : '%'} hint="Últimos 28 días" />
      </dl>

      <section aria-label="Evolución del peso" className="space-y-4">
        <SectionTitle>Evolución del peso</SectionTitle>
        <Card className="p-5">
          {measurements === null ? <p className="py-10 text-center text-[15px] text-muted">Cargando controles…</p> : <WeightChart measurements={list} />}
        </Card>
      </section>

      <section aria-label="Adherencia al plan" className="space-y-4">
        <SectionTitle>Adherencia al plan</SectionTitle>
        <Card className="p-5">
          <p className="mb-4 text-sm text-muted">Comidas que el paciente marcó como completadas en su enlace, día por día.</p>
          <AdherenceBars series={adherence} />
        </Card>
      </section>

      <section aria-label="Controles registrados" className="space-y-4">
        <SectionTitle>Controles</SectionTitle>
        {table.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-strong px-6 py-10 text-center text-[15px] text-muted">
            Aún no hay controles registrados.
          </p>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[15px]">
              <thead>
                <tr className="mono-label border-b border-border text-subtle">
                  <th className="px-5 py-3 font-normal">Fecha</th>
                  <th className="px-3 py-3 text-right font-normal">Peso</th>
                  <th className="px-3 py-3 text-right font-normal">Cambio</th>
                  <th className="px-3 py-3 text-right font-normal">% grasa</th>
                  <th className="px-3 py-3 text-right font-normal">Cintura</th>
                  <th className="px-3 py-3 font-normal">Notas</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {table.map((m, i) => {
                  const previous = table[i + 1];
                  const delta = previous ? Math.round((m.weightKg - previous.weightKg) * 10) / 10 : null;
                  return (
                    <tr key={m.id}>
                      <td className="px-5 py-3">{fmtDate(m.measuredOn)}</td>
                      <td className="px-3 py-3 text-right font-medium">{num(m.weightKg)} kg</td>
                      <td className={cn('px-3 py-3 text-right', delta === null || delta === 0 ? 'text-muted' : 'text-foreground')}>
                        {delta === null ? '—' : `${signed(delta)} kg`}
                      </td>
                      <td className="px-3 py-3 text-right text-muted">{m.bodyFatPct != null ? `${num(m.bodyFatPct)}%` : '—'}</td>
                      <td className="px-3 py-3 text-right text-muted">{m.waistCm != null ? `${num(m.waistCm)} cm` : '—'}</td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-muted" title={m.notes}>
                        {m.notes ?? ''}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setToDelete(m)}
                          aria-label={`Eliminar el control del ${fmtDate(m.measuredOn)}`}
                          className="rounded-full p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <Modal
        open={formOpen}
        onClose={() => !saving && setFormOpen(false)}
        title="Registrar control"
        description="Si ya hay un control en esa fecha, se corrige con estos datos."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="measurement-form" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar control'}
            </Button>
          </>
        }
      >
        <form id="measurement-form" onSubmit={submit} noValidate className="space-y-4">
          {formError && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger-soft-foreground">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              {(p) => <Input {...p} type="date" max={todayInParaguay()} value={form.measuredOn} onChange={setField('measuredOn')} />}
            </Field>
            <Field label="Peso (kg)">
              {(p) => <Input {...p} type="number" inputMode="decimal" step="0.1" value={form.weightKg} onChange={setField('weightKg')} />}
            </Field>
            <Field label="% de grasa (opcional)">
              {(p) => <Input {...p} type="number" inputMode="decimal" step="0.1" value={form.bodyFatPct} onChange={setField('bodyFatPct')} />}
            </Field>
            <Field label="Cintura, cm (opcional)">
              {(p) => <Input {...p} type="number" inputMode="decimal" step="0.1" value={form.waistCm} onChange={setField('waistCm')} />}
            </Field>
          </div>
          <Field label="Notas (opcional)">{(p) => <Textarea {...p} rows={2} value={form.notes} onChange={setField('notes')} />}</Field>
        </form>
      </Modal>

      <Modal
        open={toDelete !== null}
        onClose={() => !saving && setToDelete(null)}
        title="¿Eliminar este control?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="primary" className="bg-danger text-white hover:bg-danger" onClick={confirmDelete} disabled={saving}>
              {saving ? 'Eliminando…' : 'Eliminar control'}
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-foreground">
          Se borra el control del <strong>{toDelete ? fmtDate(toDelete.measuredOn) : ''}</strong> ({toDelete ? num(toDelete.weightKg) : ''} kg). No se puede deshacer.
        </p>
      </Modal>
    </div>
  );
}

function Stat({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <div className="rounded-[14px] border border-border bg-surface px-4 py-3.5 shadow-card">
      <dt className="mono-label text-subtle">{label}</dt>
      <dd className="mt-1.5 flex items-baseline gap-1 tabular-nums">
        <span className="text-[30px] font-bold leading-none tracking-[-0.04em] text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </dd>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
