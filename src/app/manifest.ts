import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NutriPlan PY - Lic. Laura Molinas',
    short_name: 'NutriPlan PY',
    description:
      'Sistema Clínico de Planificación Nutricional por Intercambios para Paraguay (Lic. Laura Molinas Reg. Prof. 6020)',
    start_url: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#059669',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  };
}
