'use client';

import React, { useState, useTransition } from 'react';
import { validateAndImportFoodsAction, ProcessedImportRow } from '@/actions/nutrition-actions';
import { Badge, Button, Card, Field, Input, PageHeader, Textarea } from '@/components/ui';
import { RefreshCw } from 'lucide-react';

const SAMPLE_PARAGUAYAN_DATA = `Sopa Paraguaya tradicional, 210, 24, 7, 10
Chipa Guasú casero, 185, 22, 6, 8
Mbejú mestizo, 260, 42, 5, 8
Pajagua Mascada, 240, 28, 12, 9
Pastel Mandi'o de carne, 250, 26, 11, 11
Vori Vori de Pollo magro, 140, 15, 9, 5
Bife de Lomito a la plancha, 145, 0, 24, 5
Dulce de Guayaba artesanal, 240, 60, 0.5, 0.1
Poroto peky cocido, 110, 19, 7, 0.6
Mandioca frita al horno, 170, 36, 1.5, 2.5`;

export default function FoodImportPage() {
  const [inputText, setInputText] = useState(SAMPLE_PARAGUAYAN_DATA);
  const [sourceName, setSourceName] = useState('Base Extendida Paraguay 2026');
  const [results, setResults] = useState<ProcessedImportRow[] | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ total: number; approved: number; review: number } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleValidate = () => {
    setStatusMessage(null);
    startTransition(async () => {
      const response = await validateAndImportFoodsAction(inputText, sourceName);
      if (response.success) {
        setResults(response.rows);
        setBatchId(response.batchId || null);
        setSummary({
          total: response.totalRows,
          approved: response.approvedCount,
          review: response.reviewCount,
        });
        setStatusMessage(
          `Validación completada: ${response.approvedCount} aprobados automáticamente y ${response.reviewCount} requieren revisión.`
        );
      } else {
        setStatusMessage(response.error || 'Error al validar datos');
      }
    });
  };

  const handleCommit = () => {
    setStatusMessage('¡Alimentos validados y clasificados correctamente en la tabla import_rows de Supabase!');
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Base extendida"
        title="Importar alimentos"
        description="Pega alimentos con su aporte por 100 g. El motor revisa la consistencia energética con la regla Atwater (CHO×4 + PRO×4 + LIP×9) y sugiere el grupo de intercambio y la porción en gramos."
      />

      <Card className="space-y-5 p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="text-xl font-medium text-foreground">Datos a validar</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setInputText(SAMPLE_PARAGUAYAN_DATA)}>
              Cargar muestra paraguaya
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setInputText('')}>
              Limpiar
            </Button>
          </div>
        </div>

        <Field label="Nombre del lote o fuente" className="sm:max-w-sm">
          {(p) => <Input {...p} value={sourceName} onChange={(e) => setSourceName(e.target.value)} />}
        </Field>

        <Field
          label="Filas"
          hint="Una línea por alimento, separada por comas: nombre, kcal/100 g, CHO, PRO, LIP."
        >
          {(p) => (
            <Textarea
              {...p}
              rows={8}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={'Mandioca cocida, 160, 38, 1.4, 0.3\nPechuga hervida, 120, 0, 26, 1.5'}
              className="font-mono text-[13px] leading-relaxed"
            />
          )}
        </Field>

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleValidate} disabled={isPending || !inputText.trim()}>
            {isPending && <RefreshCw className="h-4 w-4 animate-spin" />}
            Validar con Atwater 4/4/9
          </Button>
        </div>
      </Card>

      {statusMessage && (
        <p role="status" className="rounded-lg bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground">
          {statusMessage}
          {batchId && <span className="ml-2 font-mono text-[13px] opacity-80">Lote {batchId.substring(0, 8)}…</span>}
        </p>
      )}

      {summary && (
        <dl className="grid grid-cols-3 gap-6 border-y border-border py-6">
          <div>
            <dd className="font-display text-4xl font-medium tabular-nums text-foreground">{summary.total}</dd>
            <dt className="mt-1 text-sm text-muted">Filas procesadas</dt>
          </div>
          <div>
            <dd className="font-display text-4xl font-medium tabular-nums text-primary">{summary.approved}</dd>
            <dt className="mt-1 text-sm text-muted">Aprobadas automáticamente</dt>
          </div>
          <div>
            <dd className="font-display text-4xl font-medium tabular-nums text-warning">{summary.review}</dd>
            <dt className="mt-1 text-sm text-muted">Requieren revisión</dt>
          </div>
        </dl>
      )}

      {results && results.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-medium text-foreground">Resultado de la clasificación</h2>
              <p className="mt-1 text-[15px] text-muted">Revisa las sugerencias antes de incluirlas en el catálogo.</p>
            </div>
            <Button variant="accent" onClick={handleCommit}>
              Aprobar lote en Supabase
            </Button>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-border text-[13px] text-muted">
                    <th scope="col" className="px-5 py-3 font-medium">Alimento</th>
                    <th scope="col" className="px-3 py-3 font-medium">Por 100 g</th>
                    <th scope="col" className="px-3 py-3 font-medium">Atwater</th>
                    <th scope="col" className="px-3 py-3 font-medium">Grupo sugerido</th>
                    <th scope="col" className="px-3 py-3 font-medium">1 intercambio</th>
                    <th scope="col" className="px-5 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((row) => (
                    <tr key={row.id} className="align-top transition-colors hover:bg-surface-muted/50">
                      <td className="px-5 py-3.5">
                        <p className="text-[15px] font-medium text-foreground">{row.name}</p>
                        <p className="mt-0.5 max-w-xs text-[13px] text-muted">{row.validationMessage}</p>
                      </td>
                      <td className="px-3 py-3.5 text-[15px] tabular-nums">
                        <p className="text-foreground">{row.kcal100g} kcal</p>
                        <p className="text-[13px] text-muted">
                          {row.cho100g} / {row.pro100g} / {row.lip100g} g
                        </p>
                      </td>
                      <td className="px-3 py-3.5 text-[15px] tabular-nums">
                        <p className="text-foreground">{row.atwater.calculatedCalories} kcal</p>
                        <p className={row.atwater.isValid ? 'text-[13px] text-primary' : 'text-[13px] text-warning'}>
                          Δ {row.atwater.diffPercent}%
                        </p>
                      </td>
                      <td className="px-3 py-3.5 text-sm text-foreground">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: row.suggestedGroup.accent }}
                            aria-hidden="true"
                          />
                          {row.suggestedGroup.shortName}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-[15px] tabular-nums text-foreground">{row.baseGrams} g</td>
                      <td className="px-5 py-3.5">
                        {row.status === 'approved' ? (
                          <Badge tone="primary">Aprobado</Badge>
                        ) : (
                          <Badge tone="warning">En revisión</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}
