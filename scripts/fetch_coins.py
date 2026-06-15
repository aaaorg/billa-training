#!/usr/bin/env python3
"""Stáhne obrázky českých mincí z Wikimedia Commons (s přesnou shodou hodnoty a throttlingem)."""
import json, os, re, time, urllib.request, urllib.parse

UA = "BillaTrainerBot/1.0 (+https://github.com/aaaorg/billa-training)"
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "money", "raw")
os.makedirs(OUT, exist_ok=True)

def api(params):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)

def find(query, width, limit=12):
    d = api({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": query, "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo", "iiprop": "url|mime", "iiurlwidth": str(width),
    })
    out = []
    for p in d.get("query", {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        mime = ii.get("mime", "")
        if not mime.startswith("image") or "svg" in mime:
            continue
        out.append({"idx": p.get("index", 99), "title": p.get("title", ""), "url": ii.get("thumburl") or ii.get("url")})
    out.sort(key=lambda x: x["idx"])
    return out

def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        data = r.read()
    with open(path, "wb") as f:
        f.write(data)
    return len(data)

for v in [1, 2, 5, 10, 20, 50]:
    cands = find(f"{v} Kc Czech koruna coin reverse", 260)
    # přesná shoda číselné hodnoty v názvu (vyřadí 100/20 u dotazu na 1/2 …)
    exact = [c for c in cands if str(v) in re.findall(r"\d+", c["title"])]
    rev = [c for c in exact if "reverse" in c["title"].lower()]
    chosen = (rev or exact or cands)[:1]
    if not chosen:
        print(f"✗ {v} Kč: nic nenalezeno"); continue
    c = chosen[0]
    path = os.path.join(OUT, f"coin-{v}.jpg")
    try:
        n = download(c["url"], path)
        print(f"✓ {v} Kč: {os.path.basename(path)} ({n//1024}kB)  {c['title']}")
    except Exception as e:
        print(f"✗ {v} Kč download: {e}")
    time.sleep(3)  # throttle kvůli 429

print("Hotovo.")
