---
name: design-check
description: Detecta usos que se salen del sistema de diseño (hex fijos, slate/zinc, text-primary sin contraste, radios, texto diminuto, tipografías ajenas). Úsala después de tocar componentes o páginas, o cuando la usuaria diga "revisa el diseño", "respeta el design system" o "hay colores raros".
---

# design-check

Corre `node .claude/skills/design-check/check.mjs` (acepta `MAX=200` para ver más de 40 líneas). Reporta una línea por hallazgo; no teorices sobre cada regla.

## Reglas (resumen; la fuente es `CLAUDE.md` y `src/app/globals.css`)
| Regla | Por qué |
|---|---|
| `hex` | Los colores van como tokens para que claro/oscuro funcionen solos |
| `slate` | Paleta heredada; solo sobrevive en `mock-data.ts` (colores de grupo) |
| `text-primary` | `--primary` es verde vivo de relleno: sobre blanco no tiene contraste. Texto → `text-primary-text` |
| `dark-variant` | Los tokens ya cambian con `.dark`; `dark:` suelto indica un color fijo |
| `radius` | Tarjetas 14 px, controles 10 px, botones/pestañas `rounded-full` |
| `tiny-text` | 9–11 px solo con `mono-label` |
| `serif` | Fuentes del sistema: Space Grotesk y JetBrains Mono |
| `emoji` | Iconos de lucide-react |

## Excepciones permitidas (ya en la lista blanca del script)
`globals.css` (define los tokens), `mock-data.ts` (colores de grupo con variantes oscuras), el panel del login y `Brand.tsx` (fondos oscuros fijos a propósito).

## Cómo actuar
- Si hay hallazgos en código que tocaste, corrígelos. Si están en código que no tocaste, **repórtalos sin arreglar** (no amplíes el alcance sin que lo pidan).
- Esta skill no sustituye mirar la pantalla: un diseño puede cumplir las reglas y verse mal.
