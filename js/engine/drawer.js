/* =========================================================================
   engine/drawer.js — pokladní zásuvka, která vydrží CELOU lekci
   Přijatá hotovost se do šuplíku ukládá, drobné se z něj vracejí. Když dojde
   nominál a nejde vrátit přesně → zavolá se vedoucí na rozměnění (refill).
   ========================================================================= */
(function (BILLA) {
  'use strict';

  // LADITELNÉ: počáteční zásoba šuplíku (kolik kterého nominálu na startu lekce).
  const FLOAT = { 1: 20, 2: 15, 5: 15, 10: 20, 20: 15, 50: 10, 100: 10, 200: 6, 500: 4, 1000: 2 };

  function create() { return Object.assign({}, FLOAT); }            // denom -> count
  function count(drawer, d) { return drawer[d] || 0; }
  function total(drawer) {
    let s = 0; Object.keys(drawer).forEach(function (d) { s += d * drawer[d]; });
    return s; // v Kč
  }
  function add(drawer, d, n) { drawer[d] = (drawer[d] || 0) + (n || 1); }
  function addPieces(drawer, pieces) { pieces.forEach(function (d) { add(drawer, d, 1); }); }
  function take(drawer, d, n) {
    n = n || 1; if ((drawer[d] || 0) < n) return false; drawer[d] -= n; return true;
  }

  // Lze z DOSTUPNÝCH kusů složit PŘESNĚ `amount`? (bounded coin reachability)
  function canMake(drawer, amount) {
    if (amount <= 0) return true;
    const reach = new Uint8Array(amount + 1); reach[0] = 1;
    const denoms = Object.keys(drawer).map(Number).filter(function (d) { return drawer[d] > 0; });
    for (const d of denoms) {
      let c = drawer[d];
      while (c-- > 0) {
        for (let v = amount; v >= d; v--) { if (reach[v - d]) reach[v] = 1; }
      }
    }
    return !!reach[amount];
  }

  // Vedoucí přinese drobné — doplní nominály zpět aspoň na počáteční stav.
  function refill(drawer) {
    Object.keys(FLOAT).forEach(function (d) { drawer[d] = Math.max(drawer[d] || 0, FLOAT[d]); });
  }

  BILLA.drawer = { FLOAT, create, count, total, add, addPieces, take, canMake, refill };
})(window.BILLA = window.BILLA || {});
