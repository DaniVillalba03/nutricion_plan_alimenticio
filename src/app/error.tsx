'use client';

import { ErrorState } from '@/components/layout/ErrorState';
import { Button } from '@/components/ui';

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="Algo salió mal"
      description="No pudimos mostrar esta pantalla. Tus datos guardados no se vieron afectados; intenta de nuevo."
    >
      <Button variant="primary" onClick={() => reset()}>
        Reintentar
      </Button>
    </ErrorState>
  );
}
