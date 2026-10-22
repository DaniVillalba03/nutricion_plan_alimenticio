// Genera el PDF real del plan con Edge sin cabeza (aplica @media print y @page igual que al imprimir).
// Uso: node make-pdf.js [url=http://localhost:3100/dashboard] [tema=dark|light]
const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = process.argv[2] || 'http://localhost:3100/dashboard';
const theme = process.argv[3] || 'dark'; // se prueba en oscuro: el PDF debe salir claro igualmente

(async () => {
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const u = new URL(url);
  await page.setCookie({ name: 'nutriplan_demo_session', value: 'true', domain: u.hostname, path: '/' });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('nutriplan-theme', t), theme);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
  await new Promise((r) => setTimeout(r, 4000));
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'PDF');
    if (!b) throw new Error('No se encontró el botón PDF en la página');
    b.click();
  });
  await new Promise((r) => setTimeout(r, 1500));
  const out = path.join(__dirname, 'plan.pdf');
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  await browser.close();
  console.log('PDF en', out);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
