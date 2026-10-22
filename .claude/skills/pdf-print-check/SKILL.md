---
name: pdf-print-check
description: Genera el PDF real del plan con Edge sin cabeza, lo convierte en imágenes por hoja y permite revisar saltos de página, cortes, márgenes y colores. Úsala cada vez que cambies PlanPdfView, las reglas @media print / @page de globals.css, o cuando la usuaria diga "revisa el PDF", "se corta al imprimir" o "mira la impresión".
---

# pdf-print-check

Aprendido por las malas: mirar el texto de cada hoja **no basta** (se te escapan cabeceras partidas, tarjetas abiertas y márgenes negros). Hay que **ver cada hoja como imagen**.

## Pasos
1. **Servidor demo** (si no está corriendo): `rm -rf .next && NEXT_PUBLIC_ENABLE_DEMO_ACCESS=true npx next dev -p 3100` (en segundo plano) y espera a que `/login` responda 200.
2. **Entorno aparte** (una sola vez; **no** ensucia el proyecto): crea `$TEMP/pdfcheck`, copia `make-pdf.js` y `render.mjs` de esta carpeta y ejecuta ahí `npm init -y && npm i puppeteer-core pdfjs-dist @napi-rs/canvas`.
3. `node make-pdf.js` → `plan.pdf` (usa el paciente demo y tema oscuro a propósito: el PDF debe salir claro igual).
4. `node render.mjs` → `page-1.png … page-N.png`. **Lee cada imagen con Read.**
5. Cierra el servidor al terminar.

## Qué revisar en cada hoja
- Cabeceras de comida **no partidas** y nunca solas al pie de una hoja.
- Tarjetas que cruzan de hoja: borde cerrado abajo y reabierto arriba (`box-decoration-break: clone`).
- Márgenes **blancos** (si salen negros, falta `color-scheme: light` en `@media print`).
- Nada cortado a la derecha; pie `Pág. N de M` en todas las hojas.
- Número de hojas razonable (el plan demo debe ocupar 4).

## Gotchas
- Edge: `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` (se puede cambiar con `EDGE_PATH`).
- No hay `pdftoppm`; por eso se usa `pdfjs-dist` + `@napi-rs/canvas`.
- Las cajas de margen de `@page` (`@bottom-right`) funcionan en Chromium reciente.
