#!/usr/bin/env python3
"""Compare every hand in data/pool.json with the published S17 multi-deck basic-strategy chart
(non-pair hands, double always allowed). Exit code 1 if any hand disagrees."""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def chart(total, soft, up):
    if not soft:
        if total <= 8: return 'hit'
        if total == 9: return 'double' if 3 <= up <= 6 else 'hit'
        if total == 10: return 'double' if 2 <= up <= 9 else 'hit'
        if total == 11: return 'double' if up <= 10 else 'hit'
        if total == 12: return 'stand' if 4 <= up <= 6 else 'hit'
        if 13 <= total <= 16: return 'stand' if up <= 6 else 'hit'
        return 'stand'
    if total in (13, 14): return 'double' if up in (5, 6) else 'hit'
    if total in (15, 16): return 'double' if 4 <= up <= 6 else 'hit'
    if total == 17: return 'double' if 3 <= up <= 6 else 'hit'
    if total == 18:
        if 3 <= up <= 6: return 'double'
        if up in (2, 7, 8): return 'stand'
        return 'hit'
    return 'stand'

pool = json.load(open(os.path.join(ROOT, 'data', 'pool.json')))['hands']
diff = [h for h in pool if chart(h['total'], h['soft'], h['up']) != h['best']]
print(f"{len(pool)} pool hands checked against the published chart: {len(diff)} disagree")
for h in diff: print('  ', h['id'], 'engine:', h['best'], 'chart:', chart(h['total'], h['soft'], h['up']))
sys.exit(1 if diff else 0)
