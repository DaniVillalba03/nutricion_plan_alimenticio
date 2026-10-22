# Claude Code en NutriPlan PY: gastar menos tokens sin perder calidad

Adaptación de la guía de optimización de tokens a este proyecto (Next.js 16 + Supabase + Vercel, Windows, una persona, español). No es una copia: cada punto indica si **aplica**, qué se **instaló** y qué se **descartó** con su motivo.

## 1. Cómo es este proyecto (y por qué cambia las prioridades)
- ~100 archivos de código (9 mil líneas, 2,6 mil de ellas son datos de ejemplo). **Es chico**: el costo no está en explorar código, sino en **salidas de comandos** (`next build`, `vitest`, `tsc`), **capturas de pantalla** y **retrabajo visual** (el rediseño pasó por varias iteraciones).
- Datos de salud de pacientes: el valor de los *guardrails* es mayor que el ahorro de tokens.
- Configuración global del usuario al empezar: vacía (sin `CLAUDE.md`, skills ni plugins), modelo `sonnet`, esfuerzo medio, idioma español.

## 2. Qué se adoptó

| Pieza de la guía | Estado | Dónde |
|---|---|---|
| `CLAUDE.md` como índice (reglas + "dónde está cada cosa") | ✅ hecho (4 KB) | `CLAUDE.md` |
| Skill de verificación acotada al diff | ✅ `quality-check` | `.claude/skills/quality-check/` |
| Skill de seguridad de datos (equivale a `migration-guard`) | ✅ `supabase-guard` | `.claude/skills/supabase-guard/` |
| Convenciones de diseño como chequeo ejecutable (equivale a `docs-conventions`) | ✅ `design-check` | `.claude/skills/design-check/` |
| Procedimiento específico y costoso de rehacer | ✅ `pdf-print-check` | `.claude/skills/pdf-print-check/` |
| Subagente revisor de solo lectura con modelo barato | ✅ `code-reviewer` (sonnet) | `.claude/agents/` |
| Hook guardrail de comandos | ✅ `guard.mjs` + 26 pruebas | `.claude/hooks/` |
| Permisos de solo lectura compartidos | ✅ | `.claude/settings.json` |
| `pre-pr` + `session-close` genéricos | ✅ como **globales**: `ship` y `session-close` | `~/.claude/skills/` |

Todas las skills siguen los principios de la guía: salida determinista de **una línea por hallazgo**, alcance = el diff, **reportan, no arreglan**, y declaran lo que no verificaron.

## 3. Qué se descartó (y por qué)

| Pieza | Decisión | Motivo |
|---|---|---|
| **graphify** | No | Con ~100 archivos, leer directamente cuesta menos que construir y mantener un grafo. |
| **Linear + `doc-kickoff/doc-close/linear-conventions`** | No aplica | No hay gestor de tickets. |
| **`claude-md-management`** | No | Con un `CLAUDE.md` de 4 KB no hay qué podar. |
| **`code-simplifier`** | No | Ya existe la skill integrada `simplify`. |
| **Caveman (respuestas telegráficas)** | **No recomendado** | Se trabaja en español con tildes y explicaciones completas que la usuaria lee para decidir; el estilo telegráfico degrada eso y el ahorro de salida es pequeño frente al riesgo de malentendidos. |
| **Plugin `supabase`** | No | Daría acceso directo a la base; la regla del proyecto es no tocarla desde Claude. |
| **Hook que bloquee todo `git push`** | No | La usuaria ya aprueba cada push en el chat; un bloqueo extra sería fricción. Solo se bloquean pushes forzados. |

## 4. Recomendaciones globales (no instaladas: decide tú)

| Pieza | Conviene | Cómo | Notas |
|---|---|---|---|
| **Context7** (MCP de documentación) | ✅ Sí, a nivel usuario | `claude mcp add context7 -- npx -y @upstash/context7-mcp` (o el plugin `context7` del marketplace oficial) | Este proyecto usa versiones más nuevas que el entrenamiento del modelo (Next 16, React 19.3, Tailwind 4, Vitest 5). Para Next ya hay docs locales en `node_modules/next/dist/docs/`; Context7 cubre Supabase, Tailwind y Vitest. |
| **LSP de TypeScript** | ✅ Sí | `npm i -g typescript typescript-language-server` y `/plugin install typescript-lsp@claude-plugins-official` | Navegar por definición/referencias en vez de `grep` + leer archivos. |
| **ccstatusline** | ✅ Sí | `"statusLine": { "type": "command", "command": "npx -y ccstatusline@latest" }` en `~/.claude/settings.json` | Ver cuánto contexto llevas antes de que la sesión se encarezca. |
| **RTK** | ⚠️ Probar, no asumir | `winget install rtk-ai.rtk` y luego `rtk init -g` | **Limitación clave:** según su README el hook solo intercepta la herramienta **Bash**; `Read`, `Grep` y `Glob` no pasan por él. En la guía el 78 % del ahorro era `grep` por Bash; aquí casi todo es con las herramientas dedicadas, así que el beneficio esperado es **mucho menor** (queda `next build`, `vitest`, `git`). Si lo instalas, mide con `rtk gain` a la semana y desinstala si no aporta. Cuidado: skills que parsean salida deben usar `rtk proxy`. |

## 5. Dónde conviene que viva cada skill
Regla práctica: **global si no contiene comandos ni rutas del proyecto; de proyecto si los contiene.**

| Skill | Alcance | Razón |
|---|---|---|
| `ship` | **Global** | Verifica → commit → pregunta → push. Lee los comandos del `CLAUDE.md` de cada repo. |
| `session-close` | **Global** | Resumen de una página; no depende del stack. |
| `quality-check` | Proyecto | Usa `tsc`/`eslint`/`vitest` de este repo. |
| `design-check` | Proyecto | Reglas del design system de NutriPlan. |
| `supabase-guard` | Proyecto | Mira `supabase/migrations/` y las reglas de RLS de este esquema. |
| `pdf-print-check` | Proyecto | Depende de `PlanPdfView` y de la ruta `/dashboard`. |

Si más adelante abres otro proyecto con Next + Supabase, copia `supabase-guard` y `design-check` (cambiando la lista blanca) en vez de hacerlas globales.

## 6. Hábitos que más ahorran aquí
1. **`/clear` entre tareas distintas** (diseño, base de datos, PDF…). Es el ahorro más grande y más ignorado.
2. **Verificar con `quality-check`, no con `next build` por reflejo.** El build completo, una vez, antes del commit.
3. **Capturas con intención:** una por pantalla y estado (claro/oscuro/móvil); esperar 2 s tras cambiar de tema (la transición deja capturas a medias).
4. **Dar archivo y línea** cuando los sabes ("en `MealCard.tsx`…").
5. **Plan mode** para cambios grandes (rediseños, flujos de datos): corregir un plan es mucho más barato que corregir código.
6. **Bajar el esfuerzo** a `low` en tareas mecánicas (renombrar, ajustar textos) y subirlo para diseño o seguridad. Hoy está en `medium`, que es un buen punto de partida.
7. **Un subagente solo cuando la tarea es autocontenida y pesada** (revisar un cambio grande). Para 2–3 llamadas, en línea.

## 7. Anti-patrones que ya nos pasaron
- Dar por bueno un PDF mirando solo el texto de las hojas: **hay que ver cada hoja como imagen** (de ahí `pdf-print-check`).
- Cachés viejas de `next dev` que muestran CSS anterior: `rm -rf .next`.
- Hexadecimales y `slate-` sueltos que rompían el modo oscuro: ahora los detecta `design-check`.
- Una política RLS pública que dejaba listar todos los tokens: ahora la detecta `supabase-guard`.

## 8. Cómo medir si funciona
- `/context` al empezar y a mitad de sesión: qué pesa.
- `/cost` (o `/usage`) por sesión; comparar sesiones parecidas antes y después.
- Si una skill no se usa en dos semanas, bórrala: cada descripción cuesta tokens en cada sesión.
