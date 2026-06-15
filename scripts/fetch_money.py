#!/usr/bin/env python3
"""Stáhne referenční obrázky českých bankovek a mincí z Wikimedia Commons."""
import json, os, urllib.request, urllib.parse

UA = "BillaTrainerBot/1.0 (+https://github.com/aaaorg/billa-training)"
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "money", "raw")
os.makedirs(OUT, exist_ok=True)

def api(params):
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.load(r)

def find(query, width, limit=6):
    d = api({
        "action": "query", "format": "json", "generator": "search",
        "gsrsearch": query, "gsrnamespace": "6", "gsrlimit": str(limit),
        "prop": "imageinfo", "iiprop": "url|mime|extmetadata", "iiurlwidth": str(width),
    })
    out = []
    for p in d.get("query", {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        mime = ii.get("mime", "")
        if not mime.startswith("image") or "svg" in mime:
            continue
        meta = ii.get("extmetadata", {})
        out.append({
            "idx": p.get("index", 99),
            "title": p.get("title"),
            "url": ii.get("thumburl") or ii.get("url"),
            "lic": (meta.get("LicenseShortName", {}) or {}).get("value", "?"),
        })
    out.sort(key=lambda x: x["idx"])
    return out

def download(url, path):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        data = r.read()
    with open(path, "wb") as f:
        f.write(data)
    return len(data)

# (klíč, dotaz, šířka náhledu) — stáhneme top 2 kandidáty na ověření
ITEMS = [
    ("note-100",  "100 Czech koruna banknote obverse", 520),
    ("note-200",  "200 Czech koruna banknote obverse", 520),
    ("note-500",  "500 Czech koruna banknote obverse", 520),
    ("note-1000", "1000 Czech koruna banknote obverse", 520),
    ("note-2000", "2000 Czech koruna banknote obverse", 520),
    ("note-5000", "5000 Czech koruna banknote obverse", 520),
    ("coin-1",  "1 Czech koruna coin reverse value", 240),
    ("coin-2",  "2 Czech koruna coin", 240),
    ("coin-5",  "5 Czech koruna coin", 240),
    ("coin-10", "10 Czech koruna coin", 240),
    ("coin-20", "20 Czech koruna coin", 240),
    ("coin-50", "50 Czech koruna coin", 240),
]

report = {}
for key, query, width in ITEMS:
    try:
        cands = find(query, width)
    except Exception as e:
        print(f"✗ {key}: API chyba {e}")
        continue
    saved = []
    for i, c in enumerate(cands[:2]):
        ext = ".png" if c["url"].lower().endswith(".png") else ".jpg"
        path = os.path.join(OUT, f"{key}_{i}{ext}")
        try:
            n = download(c["url"], path)
            saved.append({"file": os.path.basename(path), "bytes": n, "title": c["title"], "lic": c["lic"]})
        except Exception as e:
            print(f"  ! {key} kandidát {i} download chyba: {e}")
    report[key] = saved
    print(f"✓ {key}: " + " | ".join(f"{s['file']} ({s['bytes']//1024}kB) {s['title']}" for s in saved))

with open(os.path.join(OUT, "report.json"), "w") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print("\nHotovo. Náhledy v assets/money/raw/")
