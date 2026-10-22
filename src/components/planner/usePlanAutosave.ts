'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MealPlan } from '@/types/nutrition';
import { planSignature } from '@/core/plan-signature';

export type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error';

interface Options {
  plan: MealPlan;
  /** Guarda el plan; resuelve `true` solo si el servidor lo confirmó. */
  save: (plan: MealPlan) => Promise<boolean>;
  /** Pausa tras el último cambio antes de guardar sola. */
  delayMs?: number;
  /** Falso mientras el plan guardado aún se está cargando: guardar entonces pisaría el real. */
  enabled?: boolean;
}

/**
 * Guarda el plan en segundo plano: espera `delayMs` tras el último cambio, no pisa un guardado
 * en curso, guarda al salir de la pantalla o ocultar la pestaña, y avisa al navegador si se
 * intenta cerrar con cambios sin guardar. "Hay cambios" se decide por contenido (`planSignature`),
 * no por referencia, así que un guardado que solo asigna ids no vuelve a marcar el plan como sucio.
 */
export function usePlanAutosave({ plan, save, delayMs = 2500, enabled = true }: Options) {
  const [savedSig, setSavedSig] = useState(() => planSignature(plan));
  const [failedSig, setFailedSig] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const planRef = useRef(plan);
  const saveRef = useRef(save);
  const savedSigRef = useRef(savedSig);
  const inflightRef = useRef<Promise<void> | null>(null);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    planRef.current = plan;
    saveRef.current = save;
    enabledRef.current = enabled;
  });

  const currentSig = planSignature(plan);
  const dirty = currentSig !== savedSig;
  const status: SaveStatus = saving ? 'saving' : !dirty ? 'saved' : failedSig === currentSig ? 'error' : 'dirty';

  /** Guarda ahora lo que haya sin guardar. Resuelve `true` si al terminar no queda nada pendiente. */
  const flush = useCallback(async (): Promise<boolean> => {
    while (inflightRef.current) await inflightRef.current;

    const snapshot = planRef.current;
    const sig = planSignature(snapshot);
    if (sig === savedSigRef.current) return true;

    setSaving(true);
    let ok = false;
    const run = (async () => {
      try {
        ok = await saveRef.current(snapshot);
      } catch {
        ok = false;
      }
      if (ok) {
        savedSigRef.current = sig;
        setSavedSig(sig);
        setFailedSig(null);
      } else {
        setFailedSig(sig);
      }
      setSaving(false);
    })();
    inflightRef.current = run;
    await run;
    inflightRef.current = null;
    return ok;
  }, []);

  /** Da por guardado un plan que llegó del servidor (p. ej. el último guardado al abrir al paciente). */
  const markSaved = useCallback((saved: MealPlan) => {
    const sig = planSignature(saved);
    savedSigRef.current = sig;
    setSavedSig(sig);
    setFailedSig(null);
  }, []);

  // Autoguardado: tras una pausa sin cambios. Un guardado fallido no se reintenta solo en bucle:
  // espera a la próxima edición o a que se pida guardar a mano.
  useEffect(() => {
    if (!enabled || !dirty || saving || failedSig === currentSig) return;
    const timer = setTimeout(() => void flush(), delayMs);
    return () => clearTimeout(timer);
  }, [enabled, dirty, saving, failedSig, currentSig, delayMs, flush]);

  // Salir de la pantalla: guardar al desmontar, al ocultar la pestaña y avisar al cerrarla
  useEffect(() => {
    const hasUnsaved = () =>
      enabledRef.current && (inflightRef.current !== null || planSignature(planRef.current) !== savedSigRef.current);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && hasUnsaved()) void flush();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsaved()) return;
      e.preventDefault();
      e.returnValue = '';
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Al cambiar de paciente o de pantalla el componente se desmonta: lo pendiente se guarda
      if (hasUnsaved()) void flush();
    };
  }, [flush]);

  return { status, flush, markSaved };
}
