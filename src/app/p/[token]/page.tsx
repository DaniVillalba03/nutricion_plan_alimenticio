import React from 'react';
import type { Metadata } from 'next';
import { getPatientPlanByTokenAction } from '@/actions/nutrition-actions';
import { PatientPortal, PortalUnavailable } from './PatientPortal';

// Página privada: los buscadores no deben indexarla ni seguir enlaces.
export const metadata: Metadata = {
  title: 'Mi plan de alimentación',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

async function PortalLoader({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getPatientPlanByTokenAction(token);

  if (!result.success || !result.client || !result.plan) return <PortalUnavailable />;
  return <PatientPortal client={result.client} plan={result.plan} />;
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
