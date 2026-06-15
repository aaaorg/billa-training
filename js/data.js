/* =========================================================================
   data.js — statická data: vzhled nominálů, katalog zboží, situační kvíz
   ========================================================================= */
(function (BILLA) {
  'use strict';

  // Vizuální metadata mincí a bankovek — reálné obrázky (Wikimedia Commons).
  // scale = relativní velikost (mince rostou 1→50, bankovky se dělají podle poměru stran obrázku).
  const IMG = 'assets/money/';
  const DENOM_META = {
    1:    { type: 'coin', img: IMG + 'coin-1.jpg',  scale: 1 },
    2:    { type: 'coin', img: IMG + 'coin-2.jpg',  scale: 2 },
    5:    { type: 'coin', img: IMG + 'coin-5.jpg',  scale: 3 },
    10:   { type: 'coin', img: IMG + 'coin-10.jpg', scale: 4 },
    20:   { type: 'coin', img: IMG + 'coin-20.jpg', scale: 5 },
    50:   { type: 'coin', img: IMG + 'coin-50.jpg', scale: 6 },
    100:  { type: 'note', img: IMG + 'note-100.jpg',  name: 'Karel IV.' },
    200:  { type: 'note', img: IMG + 'note-200.jpg',  name: 'J. A. Komenský' },
    500:  { type: 'note', img: IMG + 'note-500.jpg',  name: 'B. Němcová' },
    1000: { type: 'note', img: IMG + 'note-1000.jpg', name: 'Fr. Palacký' },
    2000: { type: 'note', img: IMG + 'note-2000.jpg', name: 'E. Destinnová' },
    5000: { type: 'note', img: IMG + 'note-5000.jpg', name: 'T. G. Masaryk' }
  };

  // Katalog zboží. cena = Kč. Vážené zboží: weighed:true + pricePerKg.
  // age:true = 18+ (alkohol/tabák). deposit = Kč záloha za kus (PET/plech).
  const PRODUCTS = [
    { id: 'rohlik',   name: 'Rohlík',                price: 2.90,  cat: 'Pečivo',   emoji: '🥖' },
    { id: 'chleb',    name: 'Chléb Šumava',          price: 32.90, cat: 'Pečivo',   emoji: '🍞' },
    { id: 'croissant',name: 'Croissant máslový',     price: 16.90, cat: 'Pečivo',   emoji: '🥐' },
    { id: 'maslo',    name: 'Máslo 250 g',           price: 49.90, cat: 'Mléčné',   emoji: '🧈' },
    { id: 'mleko',    name: 'Mléko polotučné 1 l',   price: 22.90, cat: 'Mléčné',   emoji: '🥛' },
    { id: 'jogurt',   name: 'Bílý jogurt',           price: 17.90, cat: 'Mléčné',   emoji: '🥣' },
    { id: 'eidam',    name: 'Eidam plátky',          price: 34.90, cat: 'Mléčné',   emoji: '🧀' },
    { id: 'vejce',    name: 'Vejce M 10 ks',         price: 59.90, cat: 'Mléčné',   emoji: '🥚' },
    { id: 'kure',     name: 'Kuřecí prsa',           pricePerKg: 199.90, weighed: true, plu: '201', cat: 'Maso', emoji: '🍗' },
    { id: 'banany',   name: 'Banány',                pricePerKg: 29.90,  weighed: true, plu: '110', cat: 'Ovoce a zelenina', emoji: '🍌' },
    { id: 'jablka',   name: 'Jablka Gala',           pricePerKg: 24.90,  weighed: true, plu: '101', cat: 'Ovoce a zelenina', emoji: '🍎' },
    { id: 'rajcata',  name: 'Rajčata',               pricePerKg: 49.90,  weighed: true, plu: '130', cat: 'Ovoce a zelenina', emoji: '🍅' },
    { id: 'brambory', name: 'Brambory 2,5 kg',       price: 49.90, cat: 'Ovoce a zelenina', emoji: '🥔' },
    { id: 'cola',     name: 'Coca-Cola 0,5 l',       price: 32.90, deposit: 4, cat: 'Nápoje', emoji: '🥤' },
    { id: 'mattoni',  name: 'Mattoni 1,5 l',         price: 17.90, deposit: 4, cat: 'Nápoje', emoji: '💧' },
    { id: 'pivo',     name: 'Pilsner plech 0,5 l',   price: 24.90, deposit: 4, age: true, cat: 'Nápoje', emoji: '🍺' },
    { id: 'kava',     name: 'Káva mletá 250 g',      price: 89.90, cat: 'Trvanlivé', emoji: '☕' },
    { id: 'milka',    name: 'Čokoláda Milka',        price: 24.90, cat: 'Trvanlivé', emoji: '🍫' },
    { id: 'tatranka', name: 'Tatranka',              price: 12.90, cat: 'Trvanlivé', emoji: '🍪' },
    { id: 'zvykacky', name: 'Žvýkačky',              price: 19.90, cat: 'Trvanlivé', emoji: '🫧' },
    { id: 'papir',    name: 'Toaletní papír 10 ks',  price: 64.90, cat: 'Drogerie', emoji: '🧻' },
    { id: 'pracigel', name: 'Prací gel',             price: 159.90, cat: 'Drogerie', emoji: '🧴' },
    { id: 'vino',     name: 'Víno Frankovka',        price: 119.90, age: true, cat: 'Alkohol', emoji: '🍷' },
    { id: 'cigarety', name: 'Cigarety krabička',     price: 158.00, age: true, cat: 'Tabák', emoji: '🚬' }
  ];

  // Situační kvíz. Každá otázka: text + odpovědi (jedna nebo více správných).
  const SCENARIOS = [
    {
      q: 'Zákazník platí HOTOVĚ, celkem 248,70 Kč. Kolik zaplatí?',
      options: [
        { t: '249 Kč', correct: true },
        { t: '248 Kč', correct: false },
        { t: '250 Kč', correct: false }
      ],
      explain: 'Hotovost se zaokrouhluje matematicky na celé koruny. 248,70 → 249 Kč (0,50 a výš nahoru).'
    },
    {
      q: 'Stejný nákup 248,70 Kč, ale platba KARTOU. Kolik se strhne?',
      options: [
        { t: '248,70 Kč', correct: true },
        { t: '249 Kč', correct: false },
        { t: '248 Kč', correct: false }
      ],
      explain: 'Platba kartou se NEzaokrouhluje — strhne se přesná částka 248,70 Kč. Zaokrouhluje se jen hotovost.'
    },
    {
      q: 'Zákazník kupuje 6 plechovek piva. Plechovky jsou zálohované (4 Kč/ks). Co uděláš?',
      options: [
        { t: 'K ceně připočtu zálohu za každou plechovku (6 × 4 Kč)', correct: true },
        { t: 'Zálohu neúčtuji, je v ceně', correct: false },
        { t: 'Zálohu odečtu z nákupu', correct: false }
      ],
      explain: 'Záloha za vratný obal se PŘIČÍTÁ k ceně (6 × 4 = 24 Kč navíc). Zákazník ji dostane zpět při vrácení prázdných obalů.'
    },
    {
      q: 'Zákazník přinese 12 prázdných zálohovaných lahví/plechovek (4 Kč/ks). Co s tím?',
      options: [
        { t: 'Vykoupím obaly a hodnotu (48 Kč) odečtu z nákupu nebo vyplatím', correct: true },
        { t: 'Obaly vyhodím, zálohu nevracím', correct: false },
        { t: 'Přičtu k nákupu', correct: false }
      ],
      explain: 'Vratné obaly se vykoupí — 12 × 4 = 48 Kč se odečte z nákupu (nebo vyplatí). Pozor správně spočítat počet.'
    },
    {
      q: 'Mladě vypadající zákazník kupuje láhev vína. Jak postupuješ?',
      options: [
        { t: 'Požádám o doklad totožnosti; bez 18 let neprodám', correct: true },
        { t: 'Prodám, vypadá dospěle', correct: false },
        { t: 'Prodám, ale jen jednu láhev', correct: false }
      ],
      explain: 'Alkohol a tabák jen od 18 let. Při pochybnostech VŽDY požádej o doklad. Prodej nezletilému je přestupek/trestný čin a riziko pro tebe.'
    },
    {
      q: 'Platba kartou byla ZAMÍTNUTA. Co teď?',
      options: [
        { t: 'Nabídnu opakování platby, jinou kartu nebo hotovost; zboží nevydám dokud není zaplaceno', correct: true },
        { t: 'Zboží vydám, vyřeší se to později', correct: false },
        { t: 'Pošlu zákazníka pryč', correct: false }
      ],
      explain: 'Při zamítnutí nabídni opakování / jinou kartu / hotovost. Zboží zákazník dostane až po úspěšné platbě.'
    },
    {
      q: 'Zákazník platí bankovkou 5000 Kč za nákup 80 Kč. Co uděláš?',
      options: [
        { t: 'Zkontroluji pravost bankovky a vrátím nazpět správnou částku', correct: true },
        { t: 'Odmítnu — je to moc velká bankovka', correct: false },
        { t: 'Přijmu bez kontroly', correct: false }
      ],
      explain: 'Velkou bankovku nelze bezdůvodně odmítnout, ale je dobré zkontrolovat pravost (ochranné prvky) a hlídat, zda máš dost na vrácení.'
    },
    {
      q: 'Po směně máš v zásuvce o 100 Kč MÉNĚ, než má být. Co uděláš?',
      options: [
        { t: 'Nahlásím manko nadřízenému a snažíme se zjistit příčinu', correct: true },
        { t: 'Potají doplatím ze svého, ať není problém', correct: false },
        { t: 'Nechám to být', correct: false }
      ],
      explain: 'Manko (i přebytek) se hlásí — nikdy neřeš potají. Proto je tak důležité počítat nazpět správně, abys manko nedělala.'
    },
    {
      q: 'Bankovka ti přijde podezřelá (jiná na omak, chybí ochranné prvky). Co s tím?',
      options: [
        { t: 'Zkontroluji ochranné prvky; při podezření nepřijmu a postupuji dle interních pokynů', correct: true },
        { t: 'Přijmu, ať se nezdržuju', correct: false },
        { t: 'Roztrhnu ji', correct: false }
      ],
      explain: 'Podezřelou bankovku nepřijímej a postupuj dle pokynů prodejny. Nikdy ji nepoškozuj.'
    },
    {
      q: 'Omylem jsi naúčtovala položku 2×, účtenka ještě není uzavřená. Co teď?',
      options: [
        { t: 'Stornuji přebytečnou položku ještě před dokončením platby', correct: true },
        { t: 'Nechám to a vrátím zákazníkovi peníze z kapsy', correct: false },
        { t: 'Dokončím a pak nic neřeším', correct: false }
      ],
      explain: 'Chybu oprav stornem položky ještě před uzavřením účtenky. Po zaplacení už je oprava složitější (vratka).'
    }
  ];

  BILLA.data = { DENOM_META, PRODUCTS, SCENARIOS };
})(window.BILLA = window.BILLA || {});
