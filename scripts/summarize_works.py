import json
from collections import Counter
from pathlib import Path

d = json.loads(Path("lib/works.json").read_text(encoding="utf-8"))
print("counts", dict(Counter(w["category"] for w in d["works"])), "total", len(d["works"]))
print("ABOUT", d["about"])
for w in d["works"]:
    print(f"{w['category']:18} {len(w['images']):3} {w['date'] or '-':4} {w['title'][:80]}")
