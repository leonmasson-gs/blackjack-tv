// One assertion per finding from the persona test (docs: daily-hand-persona-test.md). Each fix stays fixed.
const fs = require('fs'), path = require('path');
const { boot, sleep, q, qa, ok, known, playAll, text, PAGE, done } = require('./helpers');
const ROOT = path.join(__dirname, '..');
(async () => {
  const errors = [];
  const start = async (o = {}) => { const dom = boot({ errors, ...o }); await sleep(40); const d = dom.window.document; const g = q(d, '[data-act="age-yes"]'); if (!o.keepGate && g) g.click(); return { dom, d }; };

  // Maya / Hannah: taps
  let { dom, d } = await start({ keepGate: true }); let taps = 0; const tap = s => { q(d, s).click(); taps++; };
  tap('[data-act="age-yes"]'); tap('[data-act="play"]'); ok(taps === 2, 'Maya: 2 taps to the first decision');
  for (let i = 0; i < 5; i++) { tap('[data-choose="H"]'); tap('[data-act="next"]'); }
  ok(taps === 12, 'Maya: 12 taps from the age gate to a result');

  // Tom: structure and focus
  ({ dom, d } = await start()); q(d, '[data-act="play"]').click();
  ok(qa(d, 'h1').length === 1, 'Tom: play screen has one h1');
  ok(qa(d, 'footer').length === 1 && qa(d, 'main').length === 1 && qa(d, 'header').length === 1, 'Tom: header, main and footer landmarks present');
  q(d, '[data-choose="H"]').click(); ok(d.activeElement.id === 'fb', 'Tom: focus moves to the feedback heading after a choice');
  q(d, '[data-act="next"]').click(); ok(d.activeElement.id === 'hand-h', 'Tom: focus moves to the hand heading after Next');
  for (let i = 1; i < 5; i++) { q(d, '[data-choose="S"]').click(); q(d, '[data-act="next"]').click(); }
  ok(qa(d, 'h1').length === 1, 'Tom: result screen has one h1');
  ok(qa(d, 'button,input').every(e => (e.getAttribute('aria-label') || e.textContent.trim() || e.getAttribute('placeholder'))), 'Tom: every control has a name');

  // Tom / Dev: single-key shortcuts only when an action button is focused (WCAG 2.1.4)
  ({ dom, d } = await start()); q(d, '[data-act="play"]').click();
  const key = (el, k, rep = false) => el.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: k, bubbles: true, repeat: rep }));
  const answers = () => { const s = JSON.parse(dom.window.localStorage.getItem('dailyhand.v1')); return s.days[Object.keys(s.days)[0]].a.length; };
  key(d.body, 'h'); key(d, 's'); ok(answers() === 0, 'Tom: letter keys do nothing when nothing in the action group has focus');
  const btn = q(d, '[data-choose="S"]'); btn.focus(); key(btn, 'h', true); ok(answers() === 0, 'Dev: a held (repeating) key is ignored');
  key(btn, 'h'); ok(answers() === 1, 'Tom: with an action button focused, H records Hit');
  key(d.body, 'd'); ok(answers() === 1, 'Dev: letter keys are ignored after the hand is answered');
  const b2 = q(d, '[data-act="next"]'); b2.click(); const first = q(d, '[data-choose="H"]'); first.click(); first.click(); ok(answers() === 2, 'Dev: double-click records one answer');

  // Dev: reload mid-round, and on the feedback screen
  const saved = dom.window.localStorage.getItem('dailyhand.v1');
  ({ dom, d } = await start({ storage: { 'dailyhand.v1': saved } })); ok(/Continue today/.test(text(d)), 'Dev: home offers to continue after a reload');
  q(d, '[data-act="play"]').click(); ok(/Hand 2 of 5/.test(q(d, '#hand-h').textContent) || /Hand 3 of 5/.test(q(d, '#hand-h').textContent), 'Dev: reload resumes in the right place');
  ({ dom, d } = await start()); q(d, '[data-act="play"]').click();
  for (let i = 0; i < 4; i++) { q(d, '[data-choose="H"]').click(); q(d, '[data-act="next"]').click(); } q(d, '[data-choose="H"]').click();
  const s5 = dom.window.localStorage.getItem('dailyhand.v1');
  ({ dom, d } = await start({ storage: { 'dailyhand.v1': s5 } })); q(d, '[data-act="play"]').click();
  ok(qa(d, '.ev').length === 3 && /Hand 5 of 5/.test(q(d, '#hand-h').textContent), 'Dev: reload on the last feedback screen shows that feedback, not the result');

  // Ciaran / Nora: blocked storage, external hosts, payload
  ({ dom, d } = await start({ blockStorage: true })); await playAll(d);
  ok(/of optimal play/.test(text(d)), 'Ciaran: game plays to a result with storage blocked');
  ok(!/saved on this device/.test(text(d)) && /Storage is blocked/.test(text(d)), 'Ciaran: result does not claim to be saved when storage is blocked');
  const hosts = [...new Set((fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/(?:src|href)="https?:\/\/[^"]+/g) || []))];
  ok(hosts.length === 0, 'Nora: index.html loads nothing from other hosts' + (hosts.length ? ': ' + hosts.join(', ') : ''));
  ok(!/cookie/i.test(PAGE), 'Nora: the page uses no cookies');

  // Luis: finishing after midnight UTC still shows the result
  ({ dom, d } = await start({ now: Date.UTC(2026, 9, 9, 23, 59, 50), keepGate: false })); q(d, '[data-act="play"]').click();
  for (let i = 0; i < 4; i++) { q(d, '[data-choose="H"]').click(); q(d, '[data-act="next"]').click(); }
  q(d, '[data-choose="H"]').click(); dom.window.__t = Date.UTC(2026, 9, 10, 0, 0, 20); q(d, '[data-act="next"]').click();
  ok(/of optimal play/.test(text(d)), 'Luis: a round finished after midnight UTC still shows its result');
  ok(Object.keys(JSON.parse(dom.window.localStorage.getItem('dailyhand.v1')).days).join() === '2026-10-09', 'Luis: ...and is stored under the day it started');

  // Luis: streak maths
  const iso = n => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const mk = m => ({ age: true, nick: '', days: Object.fromEntries(Object.entries(m).map(([n, s]) => [iso(+n), { a: ['H', 'H', 'H', 'H', 'H'], s, st: 'balanced', ev: {} }])) });
  const streak = async m => { const r = await start({ storage: { 'dailyhand.v1': JSON.stringify(mk(m)) } }); return text(r.d).match(/Streak: (\d+) day|No streak yet/)[0]; };
  ok(/3 day/.test(await streak({ 1: 85, 2: 90, 3: 81 })), 'Luis: three days of 80%+ gives a streak of 3');
  ok(/1 day/.test(await streak({ 1: 85, 2: 70, 3: 90 })), 'Luis: a day under 80% breaks the streak');
  ok(/No streak/.test(await streak({ 0: 79, 1: 90 })), 'Luis: 79% today means no streak');
  ok(/2 day/.test(await streak({ 0: 80, 1: 80 })), 'Luis: 80% today plus 80% yesterday gives 2');

  // Priya: wording and the streak switch
  const ui = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(!/costly/i.test(ui), 'Priya: no "Costly" wording');
  const banned = ['you lost', "don't miss", 'last chance', 'hurry', 'only today', 'running out', 'so close', 'almost won', 'near miss', 'jackpot', 'guaranteed', 'risk-free', 'easy money', 'big win', 'limited time', 'act now', "don't lose", 'use it or lose'];
  ok(banned.every(t => !ui.toLowerCase().includes(t)), 'Priya: none of the pressure phrases from the checklist appear');
  const noStreak = ui.replace('var FEATURES = {streak:true}', 'var FEATURES = {streak:false}');
  ({ dom, d } = await start({ html: noStreak.replace('</body>', '').replace(/(<\/script>)/, '$1') }));
  ok(!/streak/i.test(text(d)), 'Priya: home shows no streak text when FEATURES.streak is false');
  q(d, '[data-act="play"]').click(); for (let i = 0; i < 5; i++) { q(d, '[data-choose="H"]').click(); q(d, '[data-act="next"]').click(); }
  ok(!/streak/i.test(text(d)) && !/streak/i.test(q(d, '#sharetext').value), 'Priya: result and share text show no streak when FEATURES.streak is false');
  ok(/Placeholder: responsible gambling/.test(ui), 'Priya: responsible gambling placeholder is visible');
  known('Priya: no help line is named yet (needs compliance)');

  // Sam: refusal is remembered for the session
  ({ dom, d } = await start({ keepGate: true })); q(d, '[data-act="age-no"]').click(); q(d, '.brand').click();
  ok(/for adults/.test(text(d)) && !q(d, '[data-act="age-yes"]'), 'Sam: after refusing, the home link does not show the age gate again');
  ({ dom, d } = await start({ keepGate: true, session: { 'dailyhand.under': '1' } })); ok(/for adults/.test(text(d)), 'Sam: refusal survives a reload in the same session');
  known('Sam: age is self-declared; real verification is not built');

  // Kit / Hannah: reset and sample tools hidden unless ?debug
  ({ dom, d } = await start({ keepGate: false })); q(d, '#nav-about').click();
  ok(!q(d, '[data-act="reset"]') && !q(d, '[data-act="sample"]'), 'Kit: reset and sample tools are hidden by default');
  ({ dom, d } = await start({ search: '?debug' })); q(d, '#nav-about').click();
  ok(!!q(d, '[data-act="reset"]') && !!q(d, '[data-act="sample"]'), 'Hannah: ?debug shows the reset and sample tools');
  known('Kit: scores are stored and trusted in the browser; the one-play-a-day limit needs a server');

  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join('; ') : ''));
  done();
})();
