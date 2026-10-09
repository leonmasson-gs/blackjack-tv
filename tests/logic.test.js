// Game logic, scoring, full play-through, and the shared-board behaviour (against a fake shared store).
const { boot, sleep, q, qa, ok, text, todayISO, done } = require('./helpers');
(async () => {
  const errors = [];
  let dom = boot({ errors }); await sleep(50);
  const w = dom.window, dh = w.__dh, d = w.document;
  ok(/18 or over/.test(text(d)), 'age gate shown first');

  const a = dh.buildDay('2026-10-09'), b = dh.buildDay('2026-10-09'), c = dh.buildDay('2026-10-10');
  ok(JSON.stringify(a.map(x => x.h.id)) === JSON.stringify(b.map(x => x.h.id)), 'same day gives the same five hands');
  ok(JSON.stringify(a.map(x => x.h.id)) !== JSON.stringify(c.map(x => x.h.id)), 'different day gives different hands');
  let bad = 0, kinds = 0;
  for (let i = 0; i < 200; i++) {
    const day = dh.buildDay('t' + i);
    day.forEach(x => { const s = x.player[0].v + x.player[1].v; const t = x.h.soft ? (s > 21 ? s - 10 : s) : s; if (t !== x.h.total || x.player[0].v === x.player[1].v) bad++; });
    if (new Set(day.map(x => x.h.best)).size >= 2) kinds++;
  }
  ok(bad === 0, '200 days: dealt cards always match the hand and are never a pair');
  ok(kinds >= 190, `200 days: at least 2 different best actions in ${kinds} days`);

  const code = { hit: 'H', stand: 'S', double: 'D' };
  const perfect = a.map(x => code[x.h.best]);
  ok(dh.dayScore(dh.summarise(a, perfect)) === 100, 'perfect play scores 100');
  ok(dh.styleOf(dh.summarise(a, perfect)) === 'textbook', 'perfect play is The Textbook');
  const worst = a.map(x => code[Object.keys(x.h.ev).sort((p, r) => x.h.ev[p] - x.h.ev[r])[0]]);
  ok(dh.dayScore(dh.summarise(a, worst)) < 10, 'worst play scores close to 0');
  const second = a.map(x => code[Object.keys(x.h.ev).sort((p, r) => x.h.ev[r] - x.h.ev[p])[1]]);
  const ss = dh.dayScore(dh.summarise(a, second)); ok(ss > 0 && ss < 100, `second-best play scores between 0 and 100 (${ss})`);
  ok(dh.validNick('Sam_99') && !dh.validNick('ab') && !dh.validNick('<script>') && !dh.validNick('Big F-u-c-k') && !dh.validNick('x'.repeat(17)), 'nickname validation');

  q(d, '[data-act="age-yes"]').click(); await sleep(10);
  ok(/Play today/.test(text(d)), 'home after the age gate');
  q(d, '[data-act="play"]').click(); await sleep(10);
  ok(qa(d, '.card').length === 4, 'a hand shows four cards (dealer up and down, two player cards)');
  ok(!/Average result/.test(text(d)), 'no expected values shown before choosing');
  const picks = ['H', 'S', 'D', 'H', 'S'];
  for (let i = 0; i < 5; i++) {
    q(d, '[data-choose="' + picks[i] + '"]').click(); await sleep(5);
    ok(qa(d, '.ev').length === 3, `hand ${i + 1}: feedback shows three expected-value bars`);
    ok(/Player stats unlock/.test(text(d)), `hand ${i + 1}: player stats stay hidden without shared data`);
    q(d, '[data-act="next"]').click(); await sleep(5);
  }
  const t = text(d);
  ok(/of optimal play/.test(t) && qa(d, '.tile').length === 5, 'result screen with five grid tiles');
  ok(/Player comparisons unlock/.test(t), 'comparisons gated below 50 players');
  ok(/needs a signed-in viewer/.test(t), 'leaderboard degrades without shared data');
  ok(q(d, '#sharetext').value.includes('Daily Hand No. 1'), 'share text built');
  q(d, '.brand').click(); await sleep(5);
  ok(/See today/.test(text(d)), 'a second play today is blocked; result shown instead');

  // sample preview (debug tools are only offered with ?debug)
  dom = boot({ errors, search: '?debug' }); await sleep(40); let e = dom.window.document;
  q(e, '[data-act="age-yes"]').click(); q(e, '[data-act="play"]').click();
  for (let i = 0; i < 5; i++) { q(e, '[data-choose="H"]').click(); q(e, '[data-act="next"]').click(); }
  q(e, '#nav-about').click(); q(e, '[data-act="sample"]').click(); q(e, '.brand').click(); q(e, '[data-act="see-result"]').click(); await sleep(5);
  ok(/Sample data/.test(text(e)) && /You beat \d+%/.test(text(e)), 'sample preview shows clearly labelled player stats');
  q(e, '.brand').click(); q(e, '[data-act="practice"]').click(); await sleep(5);
  ok(/Practice round/.test(text(e)), 'practice round starts');

  // fake shared store
  const store = {}; let w2;
  const push = () => { if (!w2._next) return; w2._next({ docs: Object.keys(store).map(k => ({ id: k.split('/')[1], data: () => store[k] })) }); };
  const mkDb = () => ({
    collection: () => ({ limit: () => ({ onSnapshot: (next) => { w2._next = next; setTimeout(push, 5); return () => {}; } }) }),
    doc: (p) => ({ set: async (v) => { store[p] = v; setTimeout(push, 5); }, delete: async () => { delete store[p]; push(); } }),
  });
  dom = boot({ errors, claude: (win) => { w2 = win; return { use: async (n) => n === 'db' ? mkDb() : n === 'user' ? { id: async () => 'u_me' } : null }; } });
  await sleep(60); const f = dom.window.document, dh2 = dom.window.__dh, today = todayISO();
  const deals = dh2.buildDay(today), best = deals.map(x => code[x.h.best]);
  for (let i = 0; i < 60; i++) { const cs = best.map((cc, j) => (i + j) % 3 === 0 ? 'H' : cc); const rows = dh2.summarise(deals, cs); store['plays/u_' + i] = { v: 1, nick: 'Player ' + i, days: { [today]: { a: cs, s: dh2.dayScore(rows), st: dh2.styleOf(rows), ev: {} } } }; }
  store['plays/u_bad'] = { v: 1, nick: '<img src=x onerror=alert(1)>', days: { [today]: { a: best, s: 100, st: 'textbook', ev: {} } } };
  push(); await sleep(30);
  q(f, '[data-act="age-yes"]').click(); q(f, '[data-act="play"]').click(); q(f, '[data-choose="' + best[0] + '"]').click(); await sleep(5);
  ok(/of today.s players also chose/.test(text(f)) && /got this hand right/.test(text(f)), 'player percentages appear once 50 or more have answered');
  q(f, '[data-act="next"]').click();
  for (let i = 1; i < 5; i++) { q(f, '[data-choose="' + best[i] + '"]').click(); q(f, '[data-act="next"]').click(); }
  await sleep(40);
  ok(/You beat \d+% of today/.test(text(f)), 'percentile shown on the result screen');
  ok(q(f, '#nick'), 'nickname prompt shown when shared data is available');
  ok(/Anyone with the link can see it/.test(text(f)), 'nickname box explains that nicknames are public');
  ok(store['plays/u_me'] && store['plays/u_me'].days[today].s === 100, 'result written to the shared store');
  q(f, '#nick').value = 'ab'; q(f, '[data-act="nick"]').click(); await sleep(5);
  ok(/Use 3 to 16/.test(text(f)), 'bad nickname rejected');
  q(f, '#nick').value = 'Eve Tester'; q(f, '[data-act="nick"]').click(); await sleep(40);
  ok(store['plays/u_me'].nick === 'Eve Tester', 'nickname saved');
  q(f, '#nav-board').click(); await sleep(10);
  ok(/Eve Tester \(you\)/.test(text(f)), 'leaderboard lists the player');
  ok(!q(f, '#app img'), 'hostile nickname is not rendered as HTML');
  q(f, '[data-tab="week"]').click(); await sleep(10);
  ok(/Week total/.test(text(f)), 'weekly board renders');
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join('; ') : ''));
  done();
})();
