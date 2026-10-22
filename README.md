# NutriPlan PY

Plataforma web para la Lic. Laura Molinas (nutricionista, Reg. Prof. 6020): arma planes de alimentación por **intercambios** con alimentos de Paraguay, los gestiona por paciente y los comparte con un enlace seguro que el paciente abre sin cuenta.

Next.js 16 (App Router) · React 19 · Tailwind 4 · Supabase (Auth + Postgres + RLS) · Vercel.

> Hoy GitHub, Vercel y Supabase son cuentas de **desarrollo**. Los pasos de abajo sirven para repetir todo en las cuentas de la empresa.

## Puesta en marcha local

```bash
npm install
cp .env.local.example .env.local   # y completa las dos variables de Supabase
npm run dev                        # http://localhost:3000
```

Sin variables de Supabase la app corre en **modo demostración** (datos de ejemplo, nada se guarda). Para probar la interfaz sin cuenta con Supabase configurado:

```bash
NEXT_PUBLIC_ENABLE_DEMO_ACCESS=true npm run dev
```

y en el navegador `document.cookie='nutriplan_demo_session=true; path=/'`. **Nunca** actives el acceso demo en producción.

## Verificación

```bash
npx tsc --noEmit && npx eslint . && npm test && npx next build
npx playwright test      # flujo principal en un navegador real (modo demostración)
```

La primera vez, `npx playwright install chromium`.

Es lo mismo que corre el CI (`.github/workflows/ci.yml`) en cada push y pull request.

## Base de datos (Supabase)

Las migraciones están en `supabase/migrations/` y se aplican **en orden** pegándolas en *SQL Editor* de Supabase:

1. `20261021000001_init_schema.sql`: tablas, índices y políticas RLS.
2. `20261022000001_secure_portal.sql`: portal por token (`get_shared_plan`, sin lectura pública de tablas).
3. `20261023000001_portal_progress.sql`: avance diario del paciente (comidas completadas y alimentos elegidos) mediante funciones que validan el token.
4. `20261024000001_hardening_and_catalog.sql`: un plan solo puede apuntar a pacientes propios, alimentos propios de la nutricionista y `save_plan` (guardado atómico de plan + versión + comidas + ítems).
5. `20261025000001_progress_tracking.sql` y `20261026000001_multiple_measurements_per_day.sql`: controles de peso y medidas por paciente (varios por día) (`client_measurements`, `add_measurement`, `delete_measurement`) y la nota de cada versión del plan.

Variables de entorno en Vercel (*Settings → Environment Variables*): `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No se usa `service_role` en ningún lado.

### Ajustes de Supabase que se hacen en el panel (no viajan con el código)

En *Authentication* del proyecto:

1. **Sign In / Providers → Email → desactivar «Allow new users to sign up»**: las cuentas se crean por invitación (*Authentication → Users → Add user*). La pantalla de ingreso ya no ofrece registro.
2. **URL Configuration**: *Site URL* = la dirección de producción; en *Redirect URLs* agregar `https://TU-DOMINIO/**` (y `http://localhost:3000/**` para desarrollo). Sin esto, el enlace de «¿Olvidaste tu contraseña?» no funciona.
3. **Passwords**: largo mínimo 10 (la pantalla de restablecer ya lo exige).
4. El correo integrado de Supabase está limitado a unos pocos mensajes por hora: para uso real conviene configurar un SMTP propio (*Authentication → SMTP Settings*).

## Despliegue

Un push a `main` despliega automáticamente en Vercel. Pasos para una cuenta nueva: importar el repositorio en Vercel, cargar las dos variables y aplicar las migraciones en el proyecto de Supabase correspondiente.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/core/` | Lógica pura y probada: intercambios, totales, operaciones del plan, validadores |
| `src/actions/` | Server actions (pacientes, planes, portal, importador) |
| `src/app/dashboard/` | Constructor de planes, pacientes, catálogo e importador |
| `src/app/p/[token]/` | Portal del paciente |
| `src/components/` | UI: primitivas (`ui/`), planificador, pacientes, tema |
| `src/app/globals.css` | Tokens de color, tipografía e impresión (PDF) |
| `supabase/migrations/` | Esquema, RLS y funciones SQL |

Convenciones de diseño y reglas del proyecto: `CLAUDE.md`. Cómo se trabaja con Claude Code: `docs/claude-code.md`.

## Seguridad

- Los datos son de salud: el portal lee **solo** por `get_shared_plan(token)` (token de 256 bits, revocable y con vencimiento); no hay políticas RLS públicas.
- Cada nutricionista ve únicamente sus pacientes y planes (RLS por `nutritionist_id`).
- Las acciones que escriben fallan con un mensaje claro si la sesión venció; nunca simulan haber guardado.
