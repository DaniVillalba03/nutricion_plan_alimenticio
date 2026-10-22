import Link from 'next/link';
import { ErrorState } from '@/components/layout/ErrorState';
import { buttonClasses } from '@/components/ui';

export default function NotFound() {
  return (
    <ErrorState title="Página no encontrada" description="La dirección no existe o fue movida.">
      <Link href="/dashboard" className={buttonClasses('primary', 'md')}>
        Ir al panel
      </Link>
    </ErrorState>
  );
}
