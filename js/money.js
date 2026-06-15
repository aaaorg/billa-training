/* =========================================================================
   money.js — jádro logiky peněz (české koruny)
   Vše počítáme v haléřích (celá čísla) kvůli přesnosti s desetinnými cenami.
   1 Kč = 100 haléřů.
   ========================================================================= */
(function (BILLA) {
  'use strict';

  // Hodnoty mincí a bankovek v Kč
  const COINS = [1, 2, 5, 10, 20, 50];
  const NOTES = [100, 200, 500, 1000, 2000, 5000];
  // Všechny nominály sestupně — pro „hladový" rozklad na minimální počet kusů
  const DENOMS = [5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

  function toHaler(kc) { return Math.round(kc * 100); }
  function toKc(haler) { return haler / 100; }

  // Zaokrouhlení částky k platbě V HOTOVOSTI na celé koruny.
  // Matematicky (0,50 a výš nahoru) — nejmenší mince je 1 Kč.
  function roundCashHaler(haler) { return Math.round(haler / 100) * 100; }
  function roundCashKc(kc) { return Math.round(kc); }

  // Rozklad částky (v celých Kč) na MINIMÁLNÍ počet mincí/bankovek (hladově).
  // Vrací pole { denom, count } seřazené sestupně.
  function makeChange(amountKc) {
    const out = [];
    let rem = Math.round(amountKc);
    for (const d of DENOMS) {
      const n = Math.floor(rem / d);
      if (n > 0) { out.push({ denom: d, count: n }); rem -= n * d; }
    }
    return out;
  }

  // Počet kusů v rozkladu
  function totalPieces(breakdown) {
    return breakdown.reduce((s, b) => s + b.count, 0);
  }

  // Součet rozkladu zpět na částku
  function sumBreakdown(breakdown) {
    return breakdown.reduce((s, b) => s + b.denom * b.count, 0);
  }

  // Je daný nominál mince (jinak bankovka)?
  function isCoin(d) { return COINS.indexOf(d) !== -1; }

  // Formátování částky v Kč: "1 234 Kč" nebo "19,90 Kč"
  // opts.decimals vynutí počet desetinných míst (jinak auto).
  function formatKc(kc, opts) {
    opts = opts || {};
    const decimals = opts.decimals != null
      ? opts.decimals
      : (Number.isInteger(kc) ? 0 : 2);
    const fixed = Math.abs(kc).toFixed(decimals);
    let parts = fixed.split('.');
    let intPart = parts[0];
    const frac = parts[1];
    // úzká pevná mezera jako oddělovač tisíců
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    let s = (kc < 0 ? '−' : '') + intPart;
    if (frac != null) s += ',' + frac;
    return s + ' Kč';
  }

  // Krátký formát bez "Kč" (pro nominály na mincích)
  function shortDenom(d) {
    return d >= 1000 ? (d / 1000) + 'k' : String(d);
  }

  BILLA.money = {
    COINS, NOTES, DENOMS,
    toHaler, toKc, roundCashHaler, roundCashKc,
    makeChange, totalPieces, sumBreakdown, isCoin,
    formatKc, shortDenom
  };
})(window.BILLA = window.BILLA || {});
