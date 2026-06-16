# BILLA – pokladní trenažér 🛒

> 🌐 **Živá verze: https://billa.disketa.eu** — nasazuje se automaticky z větve `main` přes Cloudflare Pages.

Webová appka (běží na PC i mobilu, funguje offline), kde se dá natrénovat
práce na pokladně – hlavně **vracení a počítání peněz**, aby z toho nevznikalo manko.

## Co umí

| Režim | Co trénuje |
|---|---|
| 💸 **Vracení peněz** | Spočítat, kolik vrátit + **naskládat drobné** z mincí a bankovek (s odměnou za nejmenší počet kusů). 3 obtížnosti. |
| 🔢 **Zaokrouhlování** | Hotovost na celé koruny vs. karta přesně. Rychlovka na sérii. |
| 🧮 **Počítání zásuvky** | Sečíst pokladnu z hromádky mincí a bankovek. |
| 🛒 **Plná pokladna** | Celý nákup: skenování, vážené zboží, BILLA Klub, **zálohy na obaly**, ověření věku (18+), platba hotově/kartou (i zamítnutí karty). |
| ❓ **Situace** | Kvíz na typické situace – manko, podezřelá bankovka, vrácení obalů, zamítnutá karta, prodej alkoholu… |

Postup, body a série se ukládají v zařízení (localStorage). Vše je **česky** a v **korunách**.

## Jak to spustit

### Nejjednodušeji (na počítači)
Otevři `index.html` v prohlížeči. *(Pozn.: offline režim a „instalace na plochu" fungují jen při hostování přes http/https – viz níže.)*

### S lokálním serverem (doporučeno – ať jdou všechny funkce)
```bash
cd billa-pos-training
python3 -m http.server 8080
```
Pak otevři `http://localhost:8080` (na mobilu ve stejné Wi-Fi `http://IP-počítače:8080`).

### Na mobil jako „appka"
Když je appka hostovaná (server / web), otevři ji v prohlížeči telefonu a dej
**„Přidat na plochu"**. Pak se chová jako samostatná aplikace a funguje i offline.

## Hosting
Stačí nahrát celou složku na jakýkoliv statický hosting (žádný build, žádné závislosti).
Vejde se i do Azure Blob `$web` apod.

## Vzhled / design
Appka je nově sladěná s **BILLA Design System** (claude.ai/design):
- **žlutá `#FFD400`** = primární (hlavička, hlavní CTA), **tmavě zelená `#00614A`** = sekundární
  (BILLA klub, potvrzení, ikony), **červená `#E30613`** jen pro ceny/slevy a chyby;
- písmo **Mulish** (náhrada firemního fontu, z Google Fonts; offline degraduje na systémové);
- ikony **Material Symbols Rounded** vložené jako **inline SVG** (`js/icons.js`) – fungují i offline,
  žádná závislost na CDN;
- bílé karty s jemným okrajem a měkkým stínem, kulaté zelené ikony režimů, žlutá BILLA hlavička s bílým logem.

Tokeny (barvy, stíny, poloměry, mezery) jsou v `:root` v `css/styles.css`.

## Struktura
```
index.html          # vstupní bod
manifest.json, sw.js# PWA (instalace + offline)
css/styles.css      # styly + design tokeny (:root)
assets/billa-logo-*.svg # BILLA wordmark (bílá na žluté/zelené, zelená na světlé)
js/money.js         # logika peněz (zaokrouhlování, rozklad na nominály) – jádro
js/data.js          # zboží, vzhled mincí, situační kvíz
js/icons.js         # registr vložených SVG ikon (Material Symbols Rounded)
js/storage.js       # ukládání postupu
js/ui.js            # DOM, ikony, zvuky, vizuální mince/bankovky, klávesnice
js/games/*.js       # jednotlivé tréninkové režimy
js/app.js           # router + domovská obrazovka
```

## Pár poznámek k realitě
- **Zaokrouhlování hotovosti**: matematicky na celé koruny (0,50 a výš nahoru). Karta se nezaokrouhluje.
- **Zálohy na obaly**: hodnota (4 Kč/ks) je orientační, dá se snadno změnit v `js/games/pos.js` (`DEPOSIT`) a v datech zboží.
- **Tok platby kopíruje realitu**: pokladna ukáže částku → zákazník podá hotovost → pokladní ji spočítá a zadá → pokladna ukáže kolik vrátit → pokladní odpočítá. Hrst se zobrazuje jako jednotlivé fyzické kusy (žádný multiplikátor).
- Vzhled samotného terminálu (funkční klávesy, přihlášení) je zatím odhad – cílem je natrénovat **dovednosti**, které jsou stejné na každé pokladně v ČR.

## Zdroje obrázků a licence
- Obrázky bankovek a mincí v `assets/money/` jsou reálné skeny z **Wikimedia Commons**. Staženy skripty v `scripts/`.
- Reprodukce platidel jsou použité výhradně pro **vzdělávací/tréninkový** účel.
- Ikony jsou **Material Symbols Rounded** od Google (licence **Apache-2.0**), vložené jako inline SVG v `js/icons.js`.
- Písmo **Mulish** je z Google Fonts (licence **OFL**) jako náhrada firemního fontu BILLA.
- **BILLA wordmark** (`assets/billa-logo-*.svg`) je ochranná známka BILLA; použit výhradně pro vzdělávací/tréninkový účel.
- Licence `LICENSE` se vztahuje na **kód**; obrázky, písma a logo si ponechávají vlastní licence dle zdroje.
