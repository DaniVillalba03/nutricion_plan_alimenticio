# NutriPlan PY

Plataforma web para una nutricionista (Lic. Laura Molinas, Reg. Prof. 6020): arma planes por intercambios con alimentos de Paraguay, los gestiona por paciente y los comparte con un enlace. Producción en Vercel; datos en Supabase.

@AGENTS.md

## Stack (versiones nuevas: no confíes en tu memoria)
Next.js 16 (App Router, `cacheComponents`) · React 19.3 · Tailwind 4 (tokens en `globals.css`) · Supabase (Auth + Postgres + RLS) · Zod · Vitest 5 · Vercel.
Docs de Next: `node_modules/next/dist/docs/` (más fiables que tu entrenamiento).

## Reglas no negociables
- **Idioma:** todo en español de Paraguay, con tildes y ñ. Commits y mensajes también.
- **Git:** nunca `git push` sin que la usuaria lo pida en el chat. Flujo: verificar → commit → preguntar → push. Un push a `main` despliega a producción.
- **Supabase:** por defecto no toques la base: escribe la migración en `supabase/migrations/` y dile a la usuaria que la aplique. Excepción: si ella lo pide, puedes aplicarla con el token de `token.env` (ignorado por git; solo cuentas de desarrollo) por la Management API, **probando antes en una transacción que se revierte**. Nunca uses ni imprimas `service_role` ni el contenido de `token.env`.
- **Secretos:** `.env.local` no se lee ni se imprime salvo que la usuaria lo pida; nunca se commitea.
- **Datos de pacientes son datos de salud:** el portal `/p/[token]` lee solo por `get_shared_plan(token)`; no abras políticas RLS públicas.
- **Acceso demo** (cookie sin login, datos de ejemplo): solo sin Supabase o con `NEXT_PUBLIC_ENABLE_DEMO_ACCESS=true`. Nunca en producción.
- **`src/core/` es puro:** sin React, Next ni Supabase. Toda lógica nueva lleva prueba en Vitest.

## Verificación (antes de dar algo por hecho)
```
npx tsc --noEmit && npx eslint . && npm test && npx next build
```
Para cambios visuales, además abre la pantalla en el navegador (claro y oscuro, móvil si aplica). Skill: `quality-check`.

## Diseño (sistema "técnico y cálido")
- Solo tokens: `bg-surface`, `text-muted`, `border-border`, `bg-primary`… Sin hex, sin `slate-`/`zinc-` (excepto `mock-data.ts`). Skill: `design-check`.
- El verde vivo `bg-primary` es **relleno**; para texto verde usa `text-primary-text`. El verde es acento escaso, no color de fondo.
- Titulares: grotesca (Space Grotesk) en negrita con tracking cerrado. Etiquetas de datos: clase `mono-label`. Cifras grandes con la unidad pequeña al lado.
- Botones y pestañas en píldora; tarjetas de 14 px con borde fino (sin sombras pesadas). Cuerpo ≥ 15 px; nada de texto de 10–11 px salvo `mono-label`.
- El PDF (`PlanPdfView`) fuerza paleta clara con `force-light` y se verifica con la skill `pdf-print-check`.

## Dónde está cada cosa
| Necesito… | Ve a |
|---|---|
| Lógica de intercambios, totales, equivalentes | `src/core/exchange-engine.ts` |
| Operaciones puras del plan (editar, versiones, plantillas) | `src/core/plan-operations.ts` |
| Server actions por dominio: `clients`, `plans`, `portal`, `foods` (+ `shared` con la sesión) | `src/actions/` |
| Esquema, RLS y funciones SQL | `supabase/migrations/` |
| Constructor de planes | `src/app/dashboard/page.tsx` + `src/components/planner/` |
| Portal del paciente | `src/app/p/[token]/` |
| Primitivas de UI | `src/components/ui/` |
| Tokens de color, tipografía, impresión | `src/app/globals.css` |
| Catálogo de alimentos | Base de datos (`foods`); `src/lib/mock-data.ts` solo es respaldo/demo y define los grupos |
| Guía de optimización de tokens | `docs/claude-code.md` |

`CONTEXT.md` es el brief inicial (histórico): **no es convención** (p. ej. nunca se usó shadcn/ui).

## Gotchas aprendidos
- Si el CSS en dev se ve viejo o raro: `rm -rf .next` y reinicia `next dev`.
- Para probar la UI sin cuenta: `NEXT_PUBLIC_ENABLE_DEMO_ACCESS=true npx next dev -p 3100`, y en el navegador `document.cookie='nutriplan_demo_session=true; path=/'`. Tema: `localStorage['nutriplan-theme']` (`light`/`dark`).
- Las capturas tomadas justo al cambiar de tema salen a medias (hay transición): espera 2 s.
- Con `cacheComponents`, leer cookies/sesión exige estar dentro de `<Suspense>`.
- En el tool Bash, los heredocs con apóstrofes o comillas mezcladas fallan: escribe el archivo con Write y ejecútalo.
- Las acciones de servidor se encolan: no las dispares en cascada desde el cliente.
