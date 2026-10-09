"""Independent Monte Carlo check of the EV engine: plays each hand 1.5 million times with its own
dealer and hand logic and compares the average result with engine.py. Takes a few minutes.
Needs numpy.  python3 engine/mc_check.py   (expect max difference below about 0.005)"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from engine import evs, stand_ev, hit_ev, dealer_final
rng=np.random.default_rng(20261009)
VALS=np.array([2,3,4,5,6,7,8,9,10,11]); P=np.array([1,1,1,1,1,1,1,1,4,1])/13
def draw(n): return rng.choice(VALS,size=n,p=P)
def dealer_totals(up,n):
    # peek: reject hole cards that make blackjack
    hole=draw(n)
    bad=((up==10)&(hole==11)) | ((up==11)&(hole==10))
    while bad.any():
        hole[bad]=draw(bad.sum()); bad=((up==10)&(hole==11)) | ((up==11)&(hole==10))
    raw=up+hole; aces=int(up==11)+(hole==11).astype(int)
    fix=(raw>21)&(aces>0); total=np.where(fix,raw-10,raw); aces=np.where(fix,aces-1,aces)
    while True:
        need=total<17
        if not need.any(): break
        c=draw(need.sum()); t=total[need]+c; a=aces[need]+(c==11)
        fix=(t>21)&(a>0); t=np.where(fix,t-10,t); a=np.where(fix,a-1,a)
        total[need]=t; aces[need]=a
    return np.where(total>21,0,total)  # 0 = bust
def settle(p,d):  # p player total (0 bust), d dealer (0 bust)
    return np.where(p==0,-1.0,np.where(d==0,1.0,np.sign(p-d)))
def hand_after(total,soft,c):
    hard=(total-10 if soft else total)+(1 if c==11 else c); ace=soft or c==11
    if ace and hard+10<=21: return hard+10,True
    return hard,False
def mc(total,soft,up,n=1_500_000):
    d=dealer_totals(up,n)
    st=settle(np.full(n,total),d).mean()
    # double: one card then stand
    c=draw(n); pt=np.zeros(n,int); 
    for v in VALS:
        m=c==v; t,s=hand_after(total,soft,v); pt[m]=0 if t>21 else t
    dbl=2*settle(pt,d).mean()
    return st,dbl
def mc_hit(total,soft,up,n=300_000):
    d=dealer_totals(up,n); out=np.zeros(n)
    for i in range(n):
        t,s=total,soft; first=True
        while True:
            if not first:
                if stand_ev(t,up)>=hit_ev(t,s,up): break
            first=False
            c=int(rng.choice(VALS,p=P)); t,s=hand_after(t,s,c)
            if t>21: t=0; break
        out[i]=t
    return settle(out,d).mean()
cells=[(16,False,10),(18,True,9),(11,False,6),(11,False,11),(12,False,4),(10,False,11),(9,False,2),(17,True,2),(15,False,10),(13,True,5),(18,True,11),(12,False,11)]
print(f"{'hand':<14}{'':<7}{'engine':>8}{'MC':>9}{'diff':>8}")
worst=0
for t,s,u in cells:
    e=evs(t,s,u); st,dbl=mc(t,s,u)
    nm=f"{'soft' if s else 'hard'} {t} v {'A' if u==11 else u}"
    for k,v in (('stand',st),('double',dbl)):
        diff=v-e[k]; worst=max(worst,abs(diff)); print(f"{nm:<14}{k:<7}{e[k]:>8.4f}{v:>9.4f}{diff:>+8.4f}")
for t,s,u in [(16,False,10),(11,False,11),(18,True,9),(13,True,5)]:
    e=evs(t,s,u); h=mc_hit(t,s,u); diff=h-e['hit']; worst=max(worst,abs(diff))
    print(f"{('soft' if s else 'hard')+' '+str(t)+' v '+('A' if u==11 else str(u)):<14}{'hit':<7}{e['hit']:>8.4f}{h:>9.4f}{diff:>+8.4f}")
print('max abs diff', round(worst,4))

print()
for up in (6,10,11):
    d=dealer_totals(up,2_000_000); print('dealer bust MC up',up,round((d==0).mean(),4),'engine',round(dealer_final(up)['bust'],4))
