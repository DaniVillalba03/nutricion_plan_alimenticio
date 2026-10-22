'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MealPlan, Client, ExchangeGroup, Food } from '@/types/nutrition';
import { formatFriendlyFraction, getFoodEquivalents } from '@/core/exchange-engine';
import { Printer, X, AlertTriangle } from 'lucide-react';

interface PlanPdfViewProps {
  isOpen: boolean;
  onClose: () => void;
  plan: MealPlan;
  client: Client;
  exchangeGroups: ExchangeGroup[];
  allFoods: Food[];
}

export function PlanPdfView({
  isOpen,
  onClose,
  plan,
  client,
  exchangeGroups,
  allFoods,
}: PlanPdfViewProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const groupsMap = new Map<string, ExchangeGroup>(exchangeGroups.map((g) => [g.id, g]));
  const foodsMap = new Map<string, Food>(allFoods.map((f) => [f.id, f]));

  // Comprobar si el plan contiene ítems discrecionales
  const hasDiscretionary = plan.meals.some((meal) =>
    meal.items.some((item) => {
      const g = groupsMap.get(item.groupId);
      return g?.isDiscretionary || g?.category === 'discrecional';
    })
  );

  const handlePrint = () => {
    window.print();
  };

  // Portal al <body>: al imprimir, globals.css oculta todo lo que no sea [data-print-root].
  return createPortal(
    <div
      data-print-root
      role="dialog"
      aria-modal="true"
      aria-label="Vista de impresión del plan"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex justify-center p-2 sm:p-6 print:p-0"
    >
      {/* Print Control Header (Oculto al imprimir) */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2 print:hidden bg-slate-900/90 p-2 rounded-2xl border border-slate-700 shadow-2xl">
        <button
          onClick={handlePrint}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 shadow-lg transition-all"
        >
          <Printer className="w-4 h-4" />
          Imprimir / Guardar PDF (A4)
        </button>
        <button
          onClick={onClose}
          className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          aria-label="Cerrar vista de impresión"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Contenedor del Documento A4 */}
      <div className="w-full max-w-4xl bg-white text-slate-900 shadow-2xl rounded-2xl my-auto print:my-0 print:shadow-none print:rounded-none print:w-full print:max-w-none p-8 sm:p-12 print:p-8 font-sans">
        
        {/* ============================================================== */}
        {/* 1. MEMBRETE OFICIAL SUPERIOR */}
        {/* ============================================================== */}
        <header className="border-b-2 border-emerald-700 pb-5 mb-6 text-center space-y-1">
          <div className="text-[11px] font-extrabold tracking-widest text-emerald-800 uppercase">
            REPÚBLICA DEL PARAGUAY • MINISTERIO DE SALUD PÚBLICA Y BIENESTAR SOCIAL
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 uppercase">
            LAURA MOLINAS
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-emerald-700 uppercase">
            <span>LIC. EN NUTRICIÓN</span>
            <span>•</span>
            <span>REG. PROF.: 6020</span>
            <span>•</span>
            <span>ASUNCIÓN - PARAGUAY</span>
          </div>

          {/* Caja de Referencia Oficial de Medidas */}
          <div className="mt-3.5 mx-auto max-w-2xl px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold tracking-wide">
            1 TAZA TIENE UN VOLUMEN DE 200 ml = 200 cc &nbsp;|&nbsp; 1 CUCHARADA = 10 ml / cc &nbsp;|&nbsp; 1 CUCHARADITA = 5 ml / cc
          </div>
        </header>

        {/* ============================================================== */}
        {/* 2. FICHA TÉCNICA DEL PACIENTE */}
        {/* ============================================================== */}
        <section className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className="text-slate-500 font-medium block">Paciente:</span>
              <strong className="text-sm font-black text-slate-900">{client.fullName}</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Objetivo Calórico:</span>
              <strong className="text-sm font-black text-emerald-700">{client.targetCalories} kcal / día</strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Macronutrientes:</span>
              <strong className="text-slate-800">
                {client.targetMacros.carbohydrates}g CHO ({client.macroDistributionPct.carbohydrates}%) • {client.targetMacros.proteins}g PRO ({client.macroDistributionPct.proteins}%) • {client.targetMacros.lipids}g LIP ({client.macroDistributionPct.lipids}%)
              </strong>
            </div>
            <div>
              <span className="text-slate-500 font-medium block">Fecha / Versión:</span>
              <strong className="text-slate-800">
                {new Date().toLocaleDateString('es-PY')} • Versión {plan.versionNumber || '1.0'}
              </strong>
            </div>
          </div>

          {client.exclusions && client.exclusions.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-200 text-slate-700 flex items-center gap-1.5">
              <span className="font-bold text-rose-700">Restricciones Clínicas Consideradas:</span>
              <span>{client.exclusions.join(', ')} (excluidos automáticamente de los equivalentes).</span>
            </div>
          )}
        </section>

        {/* ============================================================== */}
        {/* 3. COMIDAS DEL DÍA Y EQUIVALENTES DIRECTOS */}
        {/* ============================================================== */}
        <div className="space-y-6">
          {plan.meals.map((meal) => (
            <div key={meal.id} className="border border-slate-200 rounded-xl overflow-hidden page-break-inside-avoid">
              {/* Cabecera de Comida */}
              <div className="bg-emerald-800 text-white px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm uppercase tracking-wide">{meal.name}</h3>
                  {meal.time && <span className="text-emerald-200 text-xs font-medium">({meal.time})</span>}
                </div>
                <span className="text-xs text-emerald-100 font-semibold">
                  {meal.items.length} {meal.items.length === 1 ? 'grupo' : 'grupos'}
                </span>
              </div>

              {/* Tabla de Alimentos y Equivalentes */}
              <div className="divide-y divide-slate-100">
                {meal.items.map((item) => {
                  const group = groupsMap.get(item.groupId);
                  if (!group) return null;

                  const friendlyExchanges = formatFriendlyFraction(item.exchangeCount);
                  const suggestedFood = item.selectedFoodId ? foodsMap.get(item.selectedFoodId) : null;
                  const suggestedGrams = suggestedFood ? Math.round(suggestedFood.baseGrams * item.exchangeCount) : 0;
                  const suggestedHousehold = suggestedFood
                    ? `${formatFriendlyFraction(Math.round(suggestedFood.householdQty * item.exchangeCount * 100) / 100)} ${suggestedFood.householdUnit}`
                    : '';

                  // Obtener 3 equivalentes directos permitidos (no excluidos)
                  const allEquivalents = getFoodEquivalents(group.id, item.exchangeCount, allFoods, client);
                  const directEquivalents = allEquivalents
                    .filter((eq) => !eq.isExcluded && eq.food.id !== item.selectedFoodId)
                    .slice(0, 3);

                  return (
                    <div key={item.id} className="p-3.5 text-xs grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      {/* Grupo e Intercambios */}
                      <div className="md:col-span-3">
                        <strong className="text-slate-900 block font-bold">{group.name}</strong>
                        <span className="text-emerald-700 font-extrabold text-sm">
                          {friendlyExchanges} {item.exchangeCount === 1 ? 'Intercambio' : 'Intercambios'}
                        </span>
                        <span className="text-slate-400 block text-[11px]">
                          ({Math.round(group.referenceMacros.calories * item.exchangeCount)} kcal)
                        </span>
                      </div>

                      {/* Opción Sugerida Principal */}
                      <div className="md:col-span-4 bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                          Sugerencia Principal:
                        </span>
                        {suggestedFood ? (
                          <div>
                            <strong className="text-emerald-950 font-bold block">{suggestedFood.name}</strong>
                            <span className="text-emerald-700 font-extrabold">
                              {suggestedHousehold} ({suggestedGrams} g)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Cualquier equivalente de la lista</span>
                        )}
                      </div>

                      {/* Equivalentes Directos Permitidos */}
                      <div className="md:col-span-5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                          Otras Opciones Equivalentes Permitidas:
                        </span>
                        <ul className="space-y-0.5 text-[11px] text-slate-700">
                          {directEquivalents.map((eq) => (
                            <li key={eq.food.id} className="flex items-center justify-between">
                              <span className="truncate pr-1">• {eq.food.name}</span>
                              <strong className="text-slate-900 shrink-0 font-bold">{eq.formattedHousehold}</strong>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ============================================================== */}
        {/* 4. AVISO EDUCATIVO DISCRECIONAL (SI APLICA) */}
        {/* ============================================================== */}
        {hasDiscretionary && (
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1 page-break-inside-avoid">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>AVISO EDUCATIVO SOBRE ALIMENTOS DISCRECIONALES (LIC. LAURA MOLINAS):</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Los alimentos discrecionales (galletitas comerciales, masas de tarta/empanada o bebidas alcohólicas) aportan calorías de digestión rápida o calorías vacías derivadas de grasas saturadas, azúcares simples o alcohol etílico. Su inclusión debe ser moderada y eventual, priorizando siempre alimentos enteros, naturales y no procesados de la tabla oficial.
            </p>
          </div>
        )}

        {/* ============================================================== */}
        {/* 5. PIE DE PÁGINA OFICIAL CON CITAS */}
        {/* ============================================================== */}
        <footer className="mt-10 pt-6 border-t-2 border-slate-200 text-center space-y-2 page-break-inside-avoid">
          <div className="text-xs font-black tracking-widest text-emerald-800 uppercase italic">
            &quot;UN HÁBITO QUE FUE APRENDIDO PUEDE SER REEDUCADO&quot;
          </div>
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            &quot;CUIDA TU CUERPO, SÓLO TIENES UNO&quot;
          </div>
          <p className="text-[10px] text-slate-400 pt-2">
            NutriPlan PY • Documento Clínico Oficial para Pacientes • Lic. Laura Molinas (Reg. Prof. 6020)
          </p>
        </footer>
      </div>
    </div>,
    document.body
  );
}
