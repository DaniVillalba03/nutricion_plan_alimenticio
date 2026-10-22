import React from 'react';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { getPatientPlanByTokenAction, getPortalProgressAction } from '@/actions/portal';
import { getCatalogAction } from '@/actions/foods';
import { todayInParaguay } from '@/core/portal-progress';
import { PatientPortal, PortalUnavailable } from './PatientPortal';

// Página privada: los buscadores no deben indexarla ni seguir enlaces.
export const metadata: Metadata = {
  title: 'Mi plan de alimentación',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

async function PortalLoader({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // La fecha de hoy y el avance cambian en cada visita: se resuelve siempre al momento de la petición
  await connection();
  const result = await getPatientPlanByTokenAction(token);

  if (!result.success || !result.client || !result.plan) return <PortalUnavailable />;

  // El "hoy" del paciente es el de Paraguay; el avance de ese día llega ya con la página
  const today = todayInParaguay();
  const [initialProgress, foods] = await Promise.all([getPortalProgressAction(token, today), getCatalogAction()]);
  return (
    <PatientPortal
      client={result.client}
      plan={result.plan}
      token={token}
      today={today}
      initialProgress={initialProgress}
      foods={foods}
    />
  );
}

export default function PatientPortalPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-primary-text">
            <span className="h-2.5 w-2.5 animate-ping rounded-full bg-primary" />
            Cargando portal del paciente...
          </div>
        </div>
      }
    >
      <PortalLoader params={params} />
    </React.Suspense>
  );
}
