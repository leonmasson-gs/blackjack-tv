"""
Basic-strategy EV engine for Daily Hand (v2: hand state = (hard_sum, has_ace)).
Ruleset: infinite deck (large-shoe approximation), dealer STANDS on all 17s (S17),
dealer checks for blackjack (peek: EVs conditional on no dealer blackjack),
double on any first two cards, no splits, no surrender, no double after hit.
EV is per 1 unit staked on the hand (double = 2 units at risk).
v1 bug fixed: a soft hand that drew an Ace lost its 'soft' flag (e.g. A+A read as hard 12).
"""
from functools import lru_cache

CARDS = {2:1/13,3:1/13,4:1/13,5:1/13,6:1/13,7:1/13,8:1/13,9:1/13,10:4/13,11:1/13}

def val(hard, ace):
    """best total and softness for a hand with this hard sum (aces=1) and ace flag"""
    if ace and hard + 10 <= 21:
        return hard + 10, True
    return hard, False

def step(hard, ace, c):
    return hard + (1 if c == 11 else c), ace or c == 11

@lru_cache(None)
def dealer_dist(hard, ace):
    if hard > 21:
        return {'bust': 1.0}
    t, _ = val(hard, ace)
    if t >= 17:
        return {t: 1.0}
    out = {}
    for c, p in CARDS.items():
        h2, a2 = step(hard, ace, c)
        for k, v in dealer_dist(h2, a2).items():
            out[k] = out.get(k, 0) + p*v
    return out

def dealer_final(up):
    """dealer outcome distribution given upcard, conditioned on NO blackjack (peek)."""
    out = {}; tot_p = 0
    for hole, p in CARDS.items():
        if up == 10 and hole == 11: continue
        if up == 11 and hole == 10: continue
        tot_p += p
        h, a = step(*step(0, False, up), hole)
        for k, v in dealer_dist(h, a).items():
            out[k] = out.get(k, 0) + p*v
    return {k: v/tot_p for k, v in out.items()}

def stand_outcomes(total, up):
    d = dealer_final(up)
    win = d.get('bust', 0); lose = 0; push = 0
    for k, v in d.items():
        if k == 'bust': continue
        if total > k: win += v
        elif total < k: lose += v
        else: push += v
    return win, push, lose

def stand_ev(total, up):
    w, p, l = stand_outcomes(total, up)
    return w - l

@lru_cache(None)
def _hit(hard, ace, up):
    ev = 0
    for c, p in CARDS.items():
        h2, a2 = step(hard, ace, c)
        if h2 > 21: ev -= p
        else: ev += p * _best(h2, a2, up)
    return ev

@lru_cache(None)
def _best(hard, ace, up):
    t, _ = val(hard, ace)
    return max(stand_ev(t, up), _hit(hard, ace, up))

def _state(total, soft):
    return (total - 10, True) if soft else (total, False)

def hit_ev(total, soft, up):
    h, a = _state(total, soft); return _hit(h, a, up)

def double_ev(total, soft, up):
    h, a = _state(total, soft); ev = 0
    for c, p in CARDS.items():
        h2, a2 = step(h, a, c)
        if h2 > 21: ev -= p
        else: ev += p * stand_ev(val(h2, a2)[0], up)
    return 2*ev

def evs(total, soft, up):
    return {'stand': stand_ev(total, up), 'hit': hit_ev(total, soft, up), 'double': double_ev(total, soft, up)}

if __name__ == '__main__':
    checks = [
        (11,False,6,'double'), (11,False,10,'double'), (10,False,10,'hit'), (12,False,4,'stand'),
        (12,False,3,'hit'), (12,False,2,'hit'), (16,False,10,'hit'), (16,False,6,'stand'),
        (15,False,10,'hit'), (13,False,2,'stand'), (18,True,9,'hit'), (18,True,6,'double'),
        (18,True,2,'stand'), (17,True,6,'double'), (17,True,2,'hit'), (9,False,3,'double'), (9,False,2,'hit'),
        (15,True,5,'double'), (13,True,5,'double'), (13,True,4,'hit'),
        (10,False,11,'hit'), (11,False,11,'?'), (18,True,11,'?'), (12,False,11,'hit'),
    ]
    bad = 0
    for t,s,u,exp in checks:
        e = evs(t,s,u); best = max(e, key=e.get)
        flag = '' if best==exp or exp=='?' else '  <-- DIFFERS'
        if flag: bad += 1
        print(f"{'soft' if s else 'hard'} {t} v {u}: " + ' '.join(f"{k}={v:+.4f}" for k,v in e.items()) + f"  best={best} expected={exp}{flag}")
    print('differences:', bad)
    print('dealer bust % by upcard:', {u: round(dealer_final(u).get('bust',0)*100,1) for u in range(2,12)})
