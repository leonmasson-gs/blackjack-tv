const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs'), path = require('path');
const PAGE = fs.readFileSync(path.join(__dirname, '..', '.build', 'test.html'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const q = (d, s) => d.querySelector(s), qa = (d, s) => [...d.querySelectorAll(s)];
let failures = 0;
const ok = (c, m) => { if (!c) { failures++; console.log('FAIL:', m); } else console.log('ok  :', m); };
const known = (m) => console.log('known:', m);   // documented limitation, reported but not failing
function boot(o = {}) {
  const html = o.html || PAGE;
  const errors = o.errors || [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  return new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    url: 'https://example.test/' + (o.search || ''),
    beforeParse(w) {
      w.scrollTo = () => {};
      if (o.storage) for (const [k, v] of Object.entries(o.storage)) w.localStorage.setItem(k, v);
      if (o.session) for (const [k, v] of Object.entries(o.session)) w.sessionStorage.setItem(k, v);
      if (o.blockStorage) Object.defineProperty(w, 'localStorage', { get() { throw new w.DOMException('blocked', 'SecurityError'); } });
      if (o.claude) w.claude = o.claude(w);
      if (o.now) { const RD = w.Date; w.__t = o.now; w.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(w.__t); } static now() { return w.__t; } }; }
    } });
}
async function playAll(d, picks = 'HSDHS') {
  q(d, '[data-act="play"]').click();
  for (let i = 0; i < 5; i++) { q(d, '[data-choose="' + picks[i] + '"]').click(); q(d, '[data-act="next"]').click(); }
}
const text = d => q(d, '#app').textContent.replace(/\s+/g, ' ').trim();
const todayISO = () => new Date().toISOString().slice(0, 10);
module.exports = { JSDOM, PAGE, sleep, q, qa, ok, known, boot, playAll, text, todayISO, done: () => { console.log(failures ? `\n${failures} FAILED` : '\nPASSED'); process.exit(failures ? 1 : 0); } };
