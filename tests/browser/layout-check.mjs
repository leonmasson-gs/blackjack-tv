// Real-browser layout check. Opens every screen at seven screen widths in headless Chromium, with the same security
// headers as production, and fails if the page scrolls sideways, throws an error, or its fonts do not load. Optional: needs `npm install` in this folder (downloads a Chromium build).
//   cd tests/browser && npm install && npm run check            (add --shots to save screenshots to ./shots, --quick for two widths)
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const types = { '.html': 'text/html', '.woff2': 'font/woff2', '.json': 'application/json' };
// Serve with the same response headers vercel.json sets in production, so the Content-Security-Policy is tested too.
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const prodHeaders = Object.fromEntries((vercel.headers.find(h => h.source === '/(.*)')?.headers || []).map(h => [h.key, h.value]));
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (e, b) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { ...prodHeaders, 'content-type': types[path.extname(p)] || 'text/plain' }), res.end(b)));
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const shots = process.argv.includes('--shots'); if (shots) fs.mkdirSync('shots', { recursive: true });
const widths = process.argv.includes('--quick') ? [390, 1280] : [320, 360, 390, 768, 1024, 1280, 1920]; let problems = 0;
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const W of widths) {
  const browser = await puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: await chromium.executablePath(), headless: 'shell' });
  const page = await browser.newPage(); await page.setViewport({ width: W, height: W < 700 ? 800 : 900, isMobile: false, hasTouch: W < 700 });
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto(base + '/index.html?debug', { waitUntil: 'networkidle0' });
  const click = async s => { await page.waitForSelector(s); await page.evaluate(s => document.querySelector(s).click(), s); };
  const check = async name => {
    await wait(350);
    const r = await page.evaluate(W => ({ sw: document.documentElement.scrollWidth, bad: [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > W + 0.5; }).slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + e.className) }), W);
    const bad = r.sw > W || r.bad.length; if (bad) problems++;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${String(W).padStart(4)}px ${name}${bad ? ' overflow ' + r.sw + ' ' + r.bad : ''}`);
    if (shots) await page.screenshot({ path: `shots/${W}-${name}.png`, fullPage: true });
  };
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ({ serif: document.fonts.check('16px "Young Serif"'), sans: document.fonts.check('16px "Hanken Grotesk"'), loaded: [...document.fonts].filter(f => f.status === 'loaded').length }));
  if (!fonts.serif || !fonts.sans || fonts.loaded < 2) { problems++; console.log('FAIL fonts not loaded from this site', JSON.stringify(fonts)); } else console.log(`ok   ${String(W).padStart(4)}px fonts loaded from this site`);
  await check('gate'); await click('[data-act="age-yes"]'); await check('home');
  await click('[data-act="play"]'); await check('hand'); await click('[data-choose="H"]'); await check('feedback'); await click('[data-act="next"]');
  for (let i = 1; i < 5; i++) { await click('[data-choose="S"]'); await click('[data-act="next"]'); }
  await check('result'); await page.evaluate(() => { document.querySelector('details.numbers-d').open = true; }); await check('result-numbers');
  await click('#nav-board'); await check('board'); await click('#nav-about'); await check('about');
  if (errs.length) { problems++; console.log('FAIL page errors at', W, errs); }
  await browser.close();
}
server.close(); console.log(problems ? `\n${problems} PROBLEMS` : '\nLAYOUT OK AT ALL WIDTHS'); process.exit(problems ? 1 : 0);
