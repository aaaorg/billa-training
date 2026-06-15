/* =========================================================================
   games/till.js — Počítání zásuvky (sečti pokladnu)
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const ui = BILLA.ui, money = BILLA.money, h = ui.h, store = BILLA.store;
  const MODE = 'till';

  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  // Vygeneruje "zásuvku" — nominály s počty podle obtížnosti
  function generate(diff) {
    const denoms = diff === 1
      ? [1, 2, 5, 10, 20, 50, 100]
      : diff === 2
        ? [1, 2, 5, 10, 20, 50, 100, 200, 500]
        : money.DENOMS.slice();
    const howMany = diff === 1 ? 4 : diff === 2 ? 6 : 8;
    const chosen = [];
    const pool = denoms.slice();
    for (let i = 0; i < howMany && pool.length; i++) {
      const idx = rnd(0, pool.length - 1);
      const d = pool.splice(idx, 1)[0];
      const maxCount = d >= 500 ? 3 : d >= 50 ? 6 : 9;
      chosen.push({ denom: d, count: rnd(1, maxCount) });
    }
    chosen.sort(function (a, b) { return b.denom - a.denom; });
    const total = money.sumBreakdown(chosen);
    return { items: chosen, total: total };
  }

  function render(root) {
    ui.clear(root);
    root.appendChild(ui.screenHeader('Počítání zásuvky', 'Sečti všechny mince a bankovky'));

    const stat = store.modeStats(MODE);
    root.appendChild(h('div', { class: 'play-bar' },
      ui.difficultyPicker(function () { next(); }),
      h('div', { class: 'streak' }, h('span', { class: 'streak-num', id: 'streak' }, String(stat.streak)), ' 🔥')
    ));

    const card = h('div', { class: 'card stage' });
    root.appendChild(card);
    let round = null, typed = '';

    function updateStreak() {
      document.getElementById('streak').textContent = String(store.modeStats(MODE).streak);
    }

    function next() {
      round = generate(store.settings.difficulty); typed = '';
      ui.clear(card);
      card.appendChild(h('div', { class: 'q center' }, 'Kolik je v zásuvce celkem?'));

      const grid = h('div', { class: 'till-grid' });
      round.items.forEach(function (it) {
        grid.appendChild(h('div', { class: 'till-item' },
          ui.denomEl(it.denom, { size: 'md' }),
          h('span', { class: 'till-x' }, '×' + it.count)
        ));
      });
      card.appendChild(grid);

      const disp = h('div', { class: 'big-input', id: 'tillamt' }, '0 Kč');
      card.appendChild(disp);
      card.appendChild(ui.numpad(function (k) {
        if (k === 'back') typed = typed.slice(0, -1);
        else if (k === 'enter') return submit();
        else if (typed.length < 7) typed = (typed === '0' ? '' : typed) + k;
        disp.textContent = (typed || '0') + ' Kč';
      }));
    }

    function submit() {
      const val = parseInt(typed || '0', 10);
      const ok = val === round.total;
      store.record(MODE, ok, ok ? 8 : 0);
      updateStreak();
      ui.feedback(ok, ok ? 'Přesně!' : 'V zásuvce je ' + money.formatKc(round.total),
        ok ? '+8 bodů' : 'Zkontroluj po nominálech a sčítej průběžně.');
      setTimeout(next, ok ? 900 : 1700);
    }

    next();
  }

  BILLA.games = BILLA.games || {};
  BILLA.games.till = { title: 'Počítání zásuvky', render: render };
})(window.BILLA = window.BILLA || {});
