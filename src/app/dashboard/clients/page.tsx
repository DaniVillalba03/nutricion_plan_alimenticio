'use client';

import React, { useState } from 'react';
import { UserPlus, Users } from 'lucide-react';
import { usePatients } from '@/components/patients/PatientsProvider';
import { NewPatientModal } from '@/components/patients/NewPatientModal';
import { PatientCard } from '@/components/patients/PatientCard';
import { Button, Card, useToast } from '@/components/ui';

export default function ClientsPage() {
  const { clients, selectClient, createClient } = usePatients();
  const { toast } = useToast();
  const [isNewOpen, setIsNewOpen] = useState(false);

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pacientes</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Pacientes y metas nutricionales
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Perfiles clínicos con requerimientos calóricos, distribución de macronutrientes y restricciones de alimentos.
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsNewOpen(true)} className="shrink-0">
          <UserPlus className="h-4 w-4" />
          Nuevo paciente
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Users className="h-8 w-8 text-subtle" />
          <p className="font-semibold text-foreground">Aún no hay pacientes</p>
          <Button variant="primary" size="sm" onClick={() => setIsNewOpen(true)}>
            Crear el primero
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {clients.map((client) => (
            <PatientCard key={client.id} client={client} onOpenPlan={selectClient} />
          ))}
        </div>
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
