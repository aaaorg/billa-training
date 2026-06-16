/* =========================================================================
   storage.js — ukládání postupu a nastavení do localStorage (schema v2)
   v2 přidává XP/levely/odznaky a per-dovednost engine stav (skills).
   Staré API (record/modeStats/accuracy) zůstává kvůli nerefaktorovaným režimům.
   Bez migrace z v1 — appka ještě není naostro, starý progress se prostě zahodí.
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const KEY = 'billa-trener-v2';

  function defaults() {
    return {
      points: 0,   // legacy zrcadlo (= XP), kvůli domovské obrazovce
      xp: 0,
      badges: [],
      settings: {
        sound: true, haptics: true, difficulty: 1, buildStep: true,
        inputMode: 'row',   // 'row' = srovnané kusy | 'fist' = odsouvání po jednom
        lessonLen: 8        // kolik zákazníků na jednu lekci
      },
      stats: {},   // legacy per-mode: { plays, correct, streak, bestStreak }
      skills: {}   // engine: skill -> { L, mastery, lessonsDone, bestStreak, errors{} }
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
        xp: raw.xp || 0,
        badges: raw.badges || [],
        settings: Object.assign(d.settings, raw.settings || {}),
        stats: raw.stats || {},
        skills: raw.skills || {}
      };
    } catch (e) {
      return defaults();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---- legacy per-mode statistiky (drží domovskou + nerefaktorované režimy) ---- */
  function modeStats(mode) {
    if (!state.stats[mode]) {
      state.stats[mode] = { plays: 0, correct: 0, streak: 0, bestStreak: 0 };
    }
    return state.stats[mode];
  }

  function record(mode, correct, points) {
    const s = modeStats(mode);
    s.plays++;
    if (correct) {
      s.correct++;
      s.streak++;
      if (s.streak > s.bestStreak) s.bestStreak = s.streak;
      addXp(points || 0);
    } else {
      s.streak = 0;
      save();
    }
    return s;
  }

  function accuracy(mode) {
    const s = state.stats[mode];
    if (!s || !s.plays) return null;
    return Math.round((s.correct / s.plays) * 100);
  }

  /* ---- nový engine stav ---- */
  function skill(key) {
    if (!state.skills[key]) {
      state.skills[key] = { L: 1, mastery: 0, lessonsDone: 0, bestStreak: 0, errors: {} };
    }
    return state.skills[key];
  }

  // XP křivka → level. LADITELNÉ: prahy XP pro jednotlivé levely.
  const LEVELS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
  function levelFor(xp) {
    let lvl = 1;
    for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]) lvl = i + 1;
    return lvl;
  }
  function level() { return levelFor(state.xp); }
  function levelProgress() {
    const xp = state.xp, lvl = levelFor(xp);
    const cur = LEVELS[lvl - 1] || 0;
    const maxed = LEVELS[lvl] == null;
    const next = maxed ? cur : LEVELS[lvl];
    const span = next > cur ? next - cur : 1;
    return { level: lvl, into: xp - cur, span: span, next: next, maxed: maxed };
  }
  function addXp(n) {
    const before = levelFor(state.xp);
    state.xp += (n || 0);
    state.points = state.xp; // zrcadlo pro domovskou
    const after = levelFor(state.xp);
    save();
    return { leveledUp: after > before, level: after, gained: n || 0 };
  }

  function award(badge) {
    if (state.badges.indexOf(badge) === -1) { state.badges.push(badge); save(); return true; }
    return false;
  }
  function hasBadge(b) { return state.badges.indexOf(b) !== -1; }

  BILLA.store = {
    get state() { return state; },
    get settings() { return state.settings; },
    get points() { return state.points; },
    get xp() { return state.xp; },
    get badges() { return state.badges; },
    save, modeStats, record, accuracy,
    skill, level, levelFor, levelProgress, addXp, award, hasBadge,
    reset() { state = defaults(); save(); }
  };
})(window.BILLA = window.BILLA || {});
