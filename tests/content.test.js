// Trivia and layout structure: every fact must be true for the hands it appears on, and each screen keeps its two-column structure.
const { boot, sleep, q, qa, ok, text, todayISO, done } = require('./helpers');
(async () => {
  const errors = [];
  const dom = boot({ errors }); await sleep(50);
  const dh = dom.window.__dh, d = dom.window.document;
  const F = Object.fromEntries(dh.FACTS.map(f => [f.id, f]));

  ok(dh.FACTS.length >= 25, `fact bank has ${dh.FACTS.length} facts`);
  ok(new Set(dh.FACTS.map(f => f.id)).size === dh.FACTS.length, 'fact ids are unique');
  ok(dh.FACTS.every(f => ['engine', 'review', 'verify'].includes(f.src)), 'every fact has a review status (engine, review or verify)');
  ok(dh.FACTS.filter(f => f.g).length >= 18, 'at least 18 general facts for the home screen and Keep learning');
  ok(dh.FACTS.filter(f => f.g).every(f => typeof f.text() === 'string' && f.text().length > 20), 'every general fact renders without a hand');

  // claims must hold for every hand a fact can be attached to
  const hands = dh.H;
  const claim = (id, test) => { const bad = hands.filter(h => F[id].when(h) && !test(h)); ok(bad.length === 0, `fact "${id}" is true for every hand it can appear on` + (bad.length ? ': ' + bad.map(h => h.id) : '')); };
  claim('s18', h => h.soft && h.total === 18 && h.best === 'hit');
  claim('h12', h => !h.soft && h.total === 12 && h.best === 'hit');
  claim('safeHit', h => !h.soft && h.total <= 11);
  claim('standWeak', h => h.best === 'stand' && !h.soft);
  claim('dblSoft', h => h.soft && h.best === 'double');
  claim('dbl', h => !h.soft && h.best === 'double');
  claim('soft', h => h.soft);
  claim('hitBust', h => !h.soft && h.total >= 12 && h.total <= 16);
  claim('h16', h => !h.soft && h.total >= 15 && h.up >= 7 && h.best === 'hit');

  // numbers behind the computed facts
  ok([12, 13, 14, 15, 16, 17].map(dh.bustOnHit).join() === '4,5,6,7,8,9', 'bust-on-hit counts are 4 to 9 cards in 13 for hard 12 to 17');
  const D = dh.DEALER, fin = ['17', '18', '19', '20', '21'];
  ok(fin.every(k => D[k] <= D['20']) && D['20'] > D['17'], 'dealer finishes on 20 more often than 17, 18, 19 or 21');
  ok(D.bust > 0.27 && D.bust < 0.29 && Math.abs(fin.reduce((s, k) => s + D[k], D.bust) - 1) < 0.001, 'dealer outcomes add to 100% and bust is about 28%');
  ok(dh.BUST['6'] === Math.max(...Object.values(dh.BUST)), 'a dealer 6 busts more often than any other upcard');

  // a day's facts: five different facts, same everywhere, mostly matching the hand
  let dup = 0, mismatch = 0;
  for (let i = 0; i < 100; i++) {
    const day = dh.buildDay('f' + i), a = dh.pickFacts(day, 'f' + i), b = dh.pickFacts(day, 'f' + i);
    if (new Set(a.map(f => f.id)).size !== 5) dup++;
    if (a.map(f => f.id).join() !== b.map(f => f.id).join()) dup++;
    a.forEach((f, j) => { if (!f.when(day[j].h)) mismatch++; });
  }
  ok(dup === 0, '100 days: five different facts, identical on every run');
  ok(mismatch === 0, '100 days: every fact shown fits the hand it is shown on');
  const ex = dh.extraFacts('x', dh.pickFacts(dh.buildDay('x'), 'x'), 2);
  ok(ex.length === 2 && ex.every(f => f.g), 'Keep learning offers two general facts not already shown');

  // screens
  q(d, '[data-act="age-yes"]').click();
  ok(q(d, '.factbar') && /Did you know|Why it works|Myth|Worth remembering/.test(q(d, '.factbar').textContent), 'home shows a fact of the day');
  ok(q(d, '.home .hero') && q(d, '.home .hero-table') && q(d, '.home .cta') && q(d, '.home .factbar'), 'home has hero, table, call to action and fact areas');
  q(d, '[data-act="play"]').click();
  ok(q(d, '.split.play > .col-a .table') && q(d, '.split.play > .col-b .actions'), 'hand screen: table in one column, choices in the other');
  q(d, '[data-choose="H"]').click();
  ok(q(d, '.split.play > .col-b .panel') && q(d, '.split.play > .col-b [data-act="next"]'), 'feedback screen: explanation and Next hand beside the table');
  q(d, '[data-act="next"]').click();
  for (let i = 1; i < 5; i++) { q(d, '[data-choose="S"]').click(); q(d, '[data-act="next"]').click(); }
  ok(q(d, '.split.result > .col-a .hands') && q(d, '.split.result > .col-b #sharetext'), 'result screen: score and hands beside the panels');
  ok(qa(d, '.learn .fact-card').length === 2, 'Keep learning shows two extra facts');
  ok(qa(d, '.learn details.numbers-d table.mini-t').length === 3, 'Keep learning has three number tables');
  ok(qa(d, '.learn .mini-t tr').length === 10 + 6 + 6, 'the tables have 10 + 6 + 6 rows');
  const learnText = q(d, '.learn').textContent;
  ok(!learnText.includes('undefined') && !learnText.includes('NaN'), 'Keep learning shows no undefined or NaN');

  // ---- history thread, bonus question, home question
  const hist = dh.FACTS.filter(f => f.type === 'history');
  ok(hist.length >= 9 && hist.every(f => typeof f.y === 'number' && f.yr && f.src === 'verify' && f.g), `${hist.length} history facts, each with a year and flagged for a source check`);
  let storyBad = 0;
  for (let i = 0; i < 100; i++) {
    const a = dh.pickStories('s' + i), b = dh.pickStories('s' + i);
    const ys = a.map(f => f.y);
    if (a.length !== 5 || new Set(a.map(f => f.id)).size !== 5 || ys.join() !== ys.slice().sort((x, y) => x - y).join() || a.map(f => f.id).join() !== b.map(f => f.id).join()) storyBad++;
  }
  ok(storyBad === 0, '100 days: five different stories, oldest first, identical on every run');

  // every engine-based quiz answer must match the engine's numbers
  const TQ = dh.TQ, ans = id => { const q = TQ.find(x => x.id === id); return q.o[q.a]; };
  ok(TQ.length >= 14 && TQ.every(q => q.o.length === 3 && q.a >= 0 && q.a < 3 && q.why && ['engine', 'review', 'verify'].includes(q.src)), `${TQ.length} bonus questions, each with 3 options, an answer and a review status`);
  ok(new Set(TQ.map(q => q.a)).size === 3, 'correct answers sit in all three positions');
  ok(ans('tens') === '16' && 4 * 4 === 16, 'quiz: 16 ten-value cards');
  ok(Math.round(dh.BUST['6'] * 100) === 42 && ans('bust6') === 'About 42%', 'quiz: dealer 6 busts about 42%');
  ok(Math.abs(dh.POOLDATA.stats.natural_bj - 1 / 21) < 0.002 && ans('bj') === '1 in 21', 'quiz: natural blackjack is about 1 in 21');
  ok(dh.bustOnHit(16) === 8 && ans('hit16') === '8', 'quiz: a hit on hard 16 busts with 8 cards in 13');
  ok(['17', '18', '19', '21'].every(k => D['20'] > D[k]) && ans('finish') === '20', 'quiz: dealer finishes on 20 most often');
  ok(Math.round((D.bust + D['17'] + D['18'] + D['19']) * 100) === 70 && ans('stand20') === 'About 70%', 'quiz: standing on 20 wins about 70%');
  let l10 = 0; for (let i = 2; i <= 52; i++) l10 += Math.log10(i);
  ok(Math.abs(l10 - 67.907) < 0.01 && ans('perm') === 'About 8 followed by 67 zeros', 'quiz: 52 factorial is about 8 followed by 67 zeros');

  // per-upcard dealer fact agrees with the data
  let upBad = 0;
  hands.filter((h, i, arr) => arr.findIndex(x => x.up === h.up) === i).forEach(h => {
    const d = dh.POOLDATA.stats.up_final[h.up === 11 ? 'A' : String(h.up)]; let top = 'bust'; ['17', '18', '19', '20', '21'].forEach(k => { if (d[k] > d[top]) top = k; });
    const txt = F.upFinish.text(h); if (!txt.includes(top === 'bust' ? 'busts' : 'finishes on ' + top) || !txt.includes(Math.round(d[top] * 100) + '%')) upBad++;
  });
  ok(upBad === 0, 'per-upcard dealer facts match the dealer data for every upcard');

  // screens: home question
  const home = boot({ errors }); await sleep(40); const hd = home.window.document; q(hd, '[data-act="age-yes"]').click();
  ok(qa(hd, '[data-start]').length === 3 && q(hd, '.hero-table .ask'), 'home asks today\u2019s first hand with three answer buttons');
  q(hd, '[data-start="S"]').click();
  const sv = JSON.parse(home.window.localStorage.getItem('dailyhand.v1')), day = Object.keys(sv.days)[0];
  ok(sv.days[day].a.join() === 'S' && qa(hd, '.ev').length === 3, 'answering on the home screen records hand 1 and shows its feedback');
  ok(q(hd, '.story .yr') && q(hd, '.story .yr').textContent === dh.pickStories(day)[0].yr, 'feedback shows the first story of the day');
  q(hd, '.brand').click();
  ok(/Continue today/.test(text(hd)) && qa(hd, '[data-start]').length === 0, 'after starting, home offers Continue and no longer shows the question');
  q(hd, '[data-act="play"]').click();
  for (let k = 0; k < 14 && !/of optimal play/.test(text(hd)); k++) { const c = q(hd, '[data-choose="H"]'); if (c) c.click(); else if (q(hd, '[data-act="next"]')) q(hd, '[data-act="next"]').click(); }
  ok(/of optimal play/.test(text(hd)), 'a round started from the home question finishes normally');

  // stories under each hand, in order
  const g = boot({ errors }); await sleep(40); const gd = g.window.document; q(gd, '[data-act="age-yes"]').click(); q(gd, '[data-act="play"]').click();
  const yrs = [];
  for (let i = 0; i < 5; i++) { q(gd, '[data-choose="H"]').click(); yrs.push(q(gd, '.story .yr').textContent); q(gd, '[data-act="next"]').click(); }
  const today = todayISO();
  ok(yrs.join('|') === dh.pickStories(today).map(f => f.yr).join('|'), 'the five hands tell the day\u2019s five stories in order: ' + yrs.join(', '));
  ok(qa(gd, '.timeline li').length === 5 && qa(gd, '.timeline li .yr').map(e => e.textContent).join('|') === yrs.join('|'), 'the result screen recaps the same five stories as a timeline');

  // bonus question
  ok(qa(gd, '.bonus [data-bq]').length === 3 && !q(gd, '.bonus .opt.right'), 'bonus question shows three options and no answer yet');
  const bq = dh.TQ.find(x => x.q === q(gd, '.bonus p').textContent);
  const wrong = [0, 1, 2].find(i => i !== bq.a);
  q(gd, `[data-bq="${wrong}"]`).click();
  ok(q(gd, '.bonus .opt.right') && q(gd, '.bonus .opt.wrong') && /Not quite/.test(q(gd, '#bq-why').textContent) && qa(gd, '.bonus .opt:disabled').length === 3, 'wrong answer: shows the right one, explains, locks the options');
  ok(q(gd, '.bonus .opt.right').textContent.includes(bq.o[bq.a]), 'the highlighted answer is the correct one');
  const saved = g.window.localStorage.getItem('dailyhand.v1');
  const again = boot({ errors, storage: { 'dailyhand.v1': saved } }); await sleep(40); const ad = again.window.document;
  q(ad, '[data-act="see-result"]').click();
  ok(q(ad, '.bonus .opt.right') && q(ad, '.bonus .opt.wrong'), 'the bonus answer is remembered after a reload');
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join('; ') : ''));
  done();
})();
