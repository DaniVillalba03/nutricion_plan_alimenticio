'use client';

import React, { useState, useTransition } from 'react';
import { validateAndImportFoodsAction, ProcessedImportRow } from '@/actions/nutrition-actions';
import { Badge, Button, Card, Field, Input, Textarea } from '@/components/ui';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Scale,
  RefreshCw,
  PlusCircle,
  Database,
  Layers,
} from 'lucide-react';

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
    <div className="space-y-6 pb-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Base extendida · Validador Atwater 4/4/9
        </p>
        <h1 className="mt-1 flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          <UploadCloud className="h-7 w-7 text-primary" />
          Importador masivo de alimentos
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Pega o ingresa alimentos con su aporte nutricional por 100 g. El motor evalúa la consistencia energética con la
          regla Atwater (CHO×4 + PRO×4 + LIP×9) y sugiere el grupo de intercambio con su porción en gramos.
        </p>
      </div>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-subtle">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Entrada de datos (separados por coma o tabulación)
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setInputText(SAMPLE_PARAGUAYAN_DATA)}>
              <Sparkles className="h-3.5 w-3.5 text-warning" />
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
          label="Filas (formato: Nombre, Kcal/100g, CHO, PRO, LIP)"
          hint="Una línea por alimento: nombre, calorías, carbohidratos, proteínas y lípidos."
        >
          {(p) => (
            <Textarea
              {...p}
              rows={7}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={'Mandioca cocida, 160, 38, 1.4, 0.3\nPechuga hervida, 120, 0, 26, 1.5'}
              className="font-mono text-xs leading-relaxed"
            />
          )}
        </Field>

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleValidate} disabled={isPending || !inputText.trim()}>
            {isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
            Ejecutar validación Atwater
          </Button>
        </div>
      </Card>

      {statusMessage && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 rounded-2xl bg-primary-soft p-4 text-xs font-medium text-primary-soft-foreground"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {statusMessage}
          </span>
          {batchId && (
            <Badge tone="primary" className="font-mono">
              Lote {batchId.substring(0, 8)}…
            </Badge>
          )}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <span className="block text-xs text-muted">Filas procesadas</span>
            <strong className="text-2xl font-bold text-foreground">{summary.total}</strong>
          </Card>
          <div className="rounded-2xl bg-primary-soft p-4">
            <span className="flex items-center gap-1 text-xs font-semibold text-primary-soft-foreground">
              <CheckCircle2 className="h-3.5 w-3.5" /> Aprobados automáticamente
            </span>
            <strong className="text-2xl font-bold text-primary-soft-foreground">{summary.approved}</strong>
          </div>
          <div className="rounded-2xl bg-warning-soft p-4">
            <span className="flex items-center gap-1 text-xs font-semibold text-warning-soft-foreground">
              <AlertTriangle className="h-3.5 w-3.5" /> Requieren revisión
            </span>
            <strong className="text-2xl font-bold text-warning-soft-foreground">{summary.review}</strong>
          </div>
        </div>
      )}

      {results && results.length > 0 && (
        <Card className="space-y-4 p-5">
          <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <Database className="h-4 w-4 text-primary" />
                Clasificación y consistencia calórica
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Verifica las sugerencias del motor antes de incluirlas al catálogo oficial.
              </p>
            </div>
            <Button variant="accent" onClick={handleCommit}>
              <PlusCircle className="h-4 w-4" />
              Aprobar lote en Supabase
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-subtle">
                  <th className="px-3 py-2.5">Alimento</th>
                  <th className="px-3 py-2.5">Nutrientes / 100g</th>
                  <th className="px-3 py-2.5">Atwater 4/4/9</th>
                  <th className="px-3 py-2.5">Grupo sugerido</th>
                  <th className="px-3 py-2.5">Porción 1 intercambio</th>
                  <th className="px-3 py-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-surface-muted/50">
                    <td className="px-3 py-3">
                      <span className="block font-semibold text-foreground">{row.name}</span>
                      <span className="text-xs text-muted">{row.validationMessage}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block font-semibold text-foreground">{row.kcal100g} kcal</span>
                      <span className="text-xs text-muted">
                        {row.cho100g}g CHO · {row.pro100g}g PRO · {row.lip100g}g LIP
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="block font-mono font-semibold text-foreground">
                        {row.atwater.calculatedCalories} kcal
                      </span>
                      <span className={`text-xs font-semibold ${row.atwater.isValid ? 'text-primary' : 'text-warning'}`}>
                        Δ {row.atwater.diffPercent}%
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-white"
                        style={{ backgroundColor: row.suggestedGroup.accent }}
                      >
                        <Layers className="h-3 w-3" />
                        {row.suggestedGroup.shortName}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs font-semibold text-primary">{row.baseGrams} g</span>
                      <span className="block text-xs text-muted">por 1 intercambio</span>
                    </td>
                    <td className="px-3 py-3">
                      {row.status === 'approved' ? (
                        <Badge tone="primary">
                          <CheckCircle2 className="h-3 w-3" /> Aprobado
                        </Badge>
                      ) : (
                        <Badge tone="warning">
                          <AlertTriangle className="h-3 w-3" /> En revisión
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
