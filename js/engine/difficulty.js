/* =========================================================================
   engine/difficulty.js — adaptivní obtížnost = realistická SMĚS zákazníků
   Klíčová myšlenka (podle Jakuba): vyšší obtížnost NEZNAMENÁ, že každý
   zákazník platí velké a složité částky. Mění se jen ROZDĚLENÍ — přibývá
   těžších případů a tempo, ale lehcí zákazníci (pár korun, platí přesně)
   nikdy nezmizí. Realita = pestrá fronta.
   ========================================================================= */
(function (BILLA) {
  'use strict';
  const money = BILLA.money;

  function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function weighted(items) {
    let t = 0; items.forEach(function (i) { t += i.w; });
    let r = Math.random() * t;
    for (const it of items) { r -= it.w; if (r <= 0) return it; }
    return items[items.length - 1];
  }

  /* ============ LADITELNÉ KONSTANTY (klidně si hraj) ============ */
  // Pásma vnitřní úrovně L podle zvoleného stropu (1=Začátečník, 2=Pokročilý, 3=Profík).
  // Obtížnost se uvnitř pásma sama kalibruje podle výkonu.
  const BANDS = { 1: [1, 5], 2: [3, 9], 3: [6, 12] };
  const STEP_UP = 1;     // o kolik L nahoru po čistém kole
  const STEP_DOWN = 1;   // o kolik L dolů po chybě

  // Strop velikosti nákupu podle L. Malé nákupy ale zůstávají i nahoře!
  function cap(L) { return Math.round(30 + L * L * 22); }

  // Váhy archetypů zákazníků podle L (t = 0 na L1 … 1 na L12).
  // Lehcí (exact/small) klesají, ale NIKDY nezmizí.
  function archetypeWeights(L) {
    const t = Math.max(0, Math.min(1, (L - 1) / 11));
    return [
      { k: 'exact', w: 22 - 8 * t },   // platí přesně → nic nevracíš
      { k: 'small', w: 28 - 10 * t },  // pár korun / drobné
      { k: 'note',  w: 24 },           // hezká bankovka (stálice)
      { k: 'big',   w: 6 + 14 * t },   // velká bankovka na malý nákup
      { k: 'smart', w: 5 + 16 * t },   // chytře přidá drobné pro hezké zpět
      { k: 'fist',  w: 5 + 16 * t }    // plná hrst rozházené hotovosti
    ];
  }
  /* ============================================================== */

  function nextNote(total) {
    const notes = [20, 50, 100, 200, 500, 1000, 2000, 5000];
    return notes.find(function (n) { return n >= total; }) || Math.ceil(total / 1000) * 1000;
  }
  function roundUpTo(v, step) { return Math.ceil(v / step) * step; }

  // jak rozdělit jeden nominál na menší (pro „rozházenou" hrst)
  const SPLITS = {
    2: [1, 1], 5: [2, 2, 1], 10: [5, 5], 20: [10, 10], 50: [20, 20, 10],
    100: [50, 50], 200: [100, 100], 500: [200, 200, 100], 1000: [500, 500],
    2000: [1000, 1000], 5000: [2000, 2000, 1000]
  };

  // Rozloží částku na JEDNOTLIVÉ kusy a podle archetypu/L je „rozháže".
  // Vrací plochý seznam nominálů (jednotlivé kusy), sestupně.
  function buildPieces(amount, archetype, L) {
    const obj = {};
    money.makeChange(amount).forEach(function (b) { obj[b.denom] = b.count; });
    let frags = archetype === 'fist' ? rnd(3, 6)
      : (archetype === 'exact' || archetype === 'small') ? rnd(0, 1)
      : rnd(1, 2);
    const capPieces = 14;
    for (let i = 0; i < frags; i++) {
      const present = Object.keys(obj).filter(function (d) { return obj[d] > 0 && SPLITS[d]; });
      if (!present.length) break;
      const pieces = Object.keys(obj).reduce(function (s, d) { return s + obj[d]; }, 0);
      if (pieces >= capPieces) break;
      const d = pick(present);
      obj[d]--; if (obj[d] === 0) delete obj[d];
      SPLITS[d].forEach(function (x) { obj[x] = (obj[x] || 0) + 1; });
    }
    const list = [];
    Object.keys(obj).map(Number).sort(function (a, b) { return b - a; }).forEach(function (d) {
      for (let i = 0; i < obj[d]; i++) list.push(d);
    });
    return list;
  }

  // Vygeneruje jednoho zákazníka pro úroveň L.
  function genCustomer(L) {
    const C = cap(L);
    const a = weighted(archetypeWeights(L)).k;
    let total, tendered;
    if (a === 'exact') {
      total = rnd(3, Math.min(150, C));
      tendered = total;
    } else if (a === 'small') {
      total = rnd(5, Math.min(120, C));
      tendered = roundUpTo(total, pick([5, 10, 20]));
    } else if (a === 'note') {
      total = rnd(15, C);
      tendered = nextNote(total);
    } else if (a === 'big') {
      // velikost „velké bankovky" roste s úrovní — začátečník nedostane 5000 na malý nákup
      const pool = L < 4 ? [200, 500, 1000] : L < 8 ? [500, 1000, 2000] : [1000, 2000, 5000];
      total = rnd(20, Math.min(700, C));
      const bigger = pool.filter(function (n) { return n > total; });
      tendered = pick(bigger.length ? bigger : [pool[pool.length - 1]]);
    } else if (a === 'smart') {
      total = rnd(20, Math.min(980, C));
      const note = nextNote(total);
      const over = note - total;
      const step = pick([10, 20, 50]);
      let nice = Math.ceil((over || step) / step) * step;
      if (nice <= 0) nice = step;
      tendered = total + nice;
    } else { // fist
      total = rnd(10, C);
      tendered = nextNote(total) + pick([0, 10, 20, 50]);
    }
    if (tendered < total) tendered = nextNote(total);
    const change = tendered - total;
    return {
      archetype: a, total: total, tendered: tendered, change: change,
      pieces: buildPieces(tendered, a, L)
    };
  }

  function clampToBand(L, tier) {
    const b = BANDS[tier] || BANDS[1];
    return Math.max(b[0], Math.min(b[1], L));
  }
  // outcome: 'good' | 'ok' | 'bad'
  function nextL(L, outcome, tier) {
    if (outcome === 'good') L += STEP_UP;
    else if (outcome === 'bad') L -= STEP_DOWN;
    return clampToBand(L, tier);
  }
  function startL(tier) { return (BANDS[tier] || BANDS[1])[0]; }

  const LABELS = {
    exact: 'platí přesně', small: 'pár korun', note: 'bankovkou',
    big: 'velká bankovka', smart: 'chytře pro hezké zpět', fist: 'plná hrst'
  };

  BILLA.difficulty = {
    BANDS, genCustomer, nextL, clampToBand, startL, cap, LABELS, archetypeWeights
  };
})(window.BILLA = window.BILLA || {});
