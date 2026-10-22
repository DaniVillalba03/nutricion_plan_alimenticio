// Convierte cada hoja de plan.pdf en page-N.png para mirarla (y cuenta las hojas).
// Uso: node render.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';

const here = path.dirname(fileURLToPath(import.meta.url));
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const data = new Uint8Array(fs.readFileSync(path.join(here, 'plan.pdf')));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
console.log('Hojas:', doc.numPages);

for (let i = 1; i <= doc.numPages; i++) {
  const page = await doc.getPage(i);
  const viewport = page.getViewport({ scale: 1.1 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  fs.writeFileSync(path.join(here, `page-${i}.png`), canvas.toBuffer('image/png'));
}
console.log('listo: page-1.png … page-' + doc.numPages + '.png');
