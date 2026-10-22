---
name: quality-check
description: Verifica solo lo que cambió (tipos, lint y pruebas relacionadas) con una línea por hallazgo. Úsala antes de dar un cambio por terminado o de hacer commit; cuando la usuaria diga "verifica", "revisa que compile", "corre las pruebas de lo que toqué" o "está listo?".
---

# quality-check

Corre `node .claude/skills/quality-check/check.mjs` y reporta su salida tal cual. No corras la suite completa ni `next build` por reflejo: eso es para antes del commit (ver abajo).

## Qué hace
1. `tsc --noEmit` del proyecto (rápido; los tipos no se pueden acotar por archivo).
2. `eslint` solo sobre los archivos `src/` cambiados (modificados + nuevos sin seguimiento).
3. `vitest related --run` sobre esos archivos: corre únicamente las pruebas que dependen de ellos.

## Cómo informar
- Una línea por problema (`tipos:`, `lint:`, `pruebas:`). Nada de teoría ni de volcar logs.
- Si falla algo, **detente y arréglalo antes de seguir**: no sigas a revisar diseño ni a commitear sobre algo roto.
- No apliques arreglos que no pidieron: reporta y propón.
- Si no corriste algo, dilo ("no corrí `next build`"); no lo des por pasado.

## Antes del commit (completo, una sola vez)
`npx tsc --noEmit && npx eslint . && npm test && npx next build`
Salta el build si el diff es solo documentación o pruebas.

## Gotcha
`vitest related` necesita que git esté inicializado (lo está). Si no detecta nada relacionado, imprime "nada relacionado con el diff" y eso es correcto.
