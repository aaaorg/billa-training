/* =========================================================================
   storage.js — ukládání postupu a nastavení do localStorage
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const KEY = 'billa-trener-v1';

  function defaults() {
    return {
      points: 0,
      settings: { sound: true, haptics: true, difficulty: 1, buildStep: true },
      stats: {} // mode -> { plays, correct, streak, bestStreak }
    };
  }

  let state = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw) return defaults();
      const d = defaults();
      return {
        points: raw.points || 0,
        settings: Object.assign(d.settings, raw.settings || {}),
        stats: raw.stats || {}
      };
    } catch (e) {
      return defaults();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function modeStats(mode) {
    if (!state.stats[mode]) {
      state.stats[mode] = { plays: 0, correct: 0, streak: 0, bestStreak: 0 };
    }
    return state.stats[mode];
  }

  // Zaznamená výsledek kola. Vrací aktuální statistiku režimu.
  function record(mode, correct, points) {
    const s = modeStats(mode);
    s.plays++;
    if (correct) {
      s.correct++;
      s.streak++;
      if (s.streak > s.bestStreak) s.bestStreak = s.streak;
      state.points += (points || 0);
    } else {
      s.streak = 0;
    }
    save();
    return s;
  }

  function accuracy(mode) {
    const s = state.stats[mode];
    if (!s || !s.plays) return null;
    return Math.round((s.correct / s.plays) * 100);
  }

  BILLA.store = {
    get state() { return state; },
    get settings() { return state.settings; },
    get points() { return state.points; },
    save, modeStats, record, accuracy,
    reset() { state = defaults(); save(); }
  };
})(window.BILLA = window.BILLA || {});
