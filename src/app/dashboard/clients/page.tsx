'use client';

import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { usePatients } from '@/components/patients/PatientsProvider';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { PatientCard } from '@/components/patients/PatientCard';
import { Button, Card, PageHeader, useToast } from '@/components/ui';

export default function ClientsPage() {
  const { clients, loading, selectClient, createClient } = usePatients();
  const { toast } = useToast();
  const [isNewOpen, setIsNewOpen] = useState(false);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Pacientes"
        title="Tus pacientes"
        description="Requerimientos calóricos, reparto de macronutrientes y restricciones de cada perfil."
        actions={
          <Button variant="primary" onClick={() => setIsNewOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Nuevo paciente
          </Button>
        }
      />

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-strong px-6 py-16 text-center">
          {loading ? (
            <p className="text-[15px] text-muted">Cargando pacientes…</p>
          ) : (
            <>
              <p className="text-2xl font-bold tracking-[-0.035em] text-foreground">Aún no hay pacientes</p>
              <p className="mx-auto mt-1.5 max-w-sm text-[15px] text-muted">
                Crea el primero para empezar a armar su plan de intercambios.
              </p>
              <Button variant="primary" className="mt-5" onClick={() => setIsNewOpen(true)}>
                Crear el primer paciente
              </Button>
            </>
          )}
        </div>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {clients.map((client) => (
              <PatientCard key={client.id} client={client} onOpenPlan={selectClient} />
            ))}
          </ul>
        </Card>
      )}

      <NewPatientModal
        open={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onCreate={async (client, input) => {
          setIsNewOpen(false);
          const result = await createClient(client, input);
          toast(result.ok ? `Paciente "${client.fullName}" creado` : `No se pudo crear el paciente: ${result.error}`);
        }}
      />
    </div>
  );
}
