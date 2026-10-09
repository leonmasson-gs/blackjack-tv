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
  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join('; ') : ''));
  done();
})();
