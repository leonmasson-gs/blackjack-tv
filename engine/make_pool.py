#!/usr/bin/env python3
"""Generate data/pool.json: every decisive non-pair hand with its expected values.
Run from anywhere:  python3 engine/make_pool.py   then   python3 scripts/build.py"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine import evs, stand_outcomes, dealer_final, dealer_dist

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "pool.json")
TIE = 0.01                      # options within this EV of the best count as right; such hands are left out
UPS = list(range(2, 12))        # 11 = Ace
upname = lambda u: 'A' if u == 11 else str(u)

def instinct(total, soft, up):
    """The beginner's rule used to flag 'instinct traps' (our own definition, see README)."""
    if soft: return 'stand' if total >= 18 else 'hit'
    if total >= 17: return 'stand'
    if total <= 11: return 'hit'
    return 'stand' if up <= 6 else 'hit'

hands, dropped = [], []
for soft, totals in ((False, range(9, 17)), (True, range(13, 19))):
    for t in totals:
        for u in UPS:
            e = evs(t, soft, u)
            order = sorted(e, key=e.get, reverse=True)
            best, second, worst = order
            gap2, spread = e[best] - e[second], e[best] - e[worst]
            hid = f"{'s' if soft else 'h'}{t}-{u}"
            if gap2 < TIE:
                dropped.append(hid); continue
            w, p, l = stand_outcomes(t, u)
            ins = instinct(t, soft, u)
            hands.append({'id': hid, 'soft': soft, 'total': t, 'up': u,
                          'ev': {k: round(v, 4) for k, v in e.items()}, 'best': best,
                          'gap2': round(gap2, 4), 'spread': round(spread, 4),
                          'stand': [round(w, 3), round(p, 3), round(l, 3)],
                          'trap': ins != best, 'instinct': ins})
bust = {upname(u): round(dealer_final(u).get('bust', 0), 4) for u in UPS}
# Whole-game dealer outcome (all upcards, natural blackjack counted as 21) and natural blackjack chance. Used by the trivia.
d = dealer_dist(0, False)
stats = {'dealer': {('bust' if k == 'bust' else str(k)): round(v, 4) for k, v in d.items()}, 'natural_bj': round(8/169, 4)}
with open(OUT, "w") as f: json.dump({'hands': hands, 'bust': bust, 'stats': stats}, f, separators=(',', ':'))
print(f"{len(hands)} hands written to {os.path.relpath(OUT)}; {len(dropped)} near-ties left out: {', '.join(dropped)}")
print("dealer bust % :", {k: round(v*100, 1) for k, v in bust.items()})

print('dealer overall:', stats['dealer'], '| natural blackjack:', stats['natural_bj'])
