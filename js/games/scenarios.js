/* =========================================================================
   games/scenarios.js — Situace (kvíz na typické situace u pokladny)
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const ui = BILLA.ui, h = ui.h, store = BILLA.store;
  const MODE = 'scenarios';
  const QS = BILLA.data.SCENARIOS;

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function render(root) {
    ui.clear(root);
    root.appendChild(ui.screenHeader('Situace', 'Jak správně reagovat u pokladny'));

    const stat = store.modeStats(MODE);
    root.appendChild(h('div', { class: 'play-bar' },
      h('div', { class: 'hint-chip' }, 'Vyber správný postup'),
      h('div', { class: 'streak' }, h('span', { class: 'streak-num', id: 'streak' }, String(stat.streak)),
        ui.icon('local_fire_department', { fill: true, cls: 'streak-fire' }))
    ));

    const card = h('div', { class: 'card stage' });
    root.appendChild(card);

    let order = shuffle(QS), idx = 0, locked = false;

    function updateStreak() {
      document.getElementById('streak').textContent = String(store.modeStats(MODE).streak);
    }

    function next() {
      if (idx >= order.length) { order = shuffle(QS); idx = 0; }
      const q = order[idx++];
      locked = false;
      ui.clear(card);
      card.appendChild(h('div', { class: 'q' }, q.q));
      const opts = h('div', { class: 'choices vertical' });
      shuffle(q.options).forEach(function (o) {
        opts.appendChild(h('button', {
          class: 'btn choice wide',
          onclick: function () { answer(o, q, this, opts); }
        }, o.t));
      });
      card.appendChild(opts);
    }

    function answer(o, q, btn, opts) {
      if (locked) return;
      locked = true;
      const ok = !!o.correct;
      btn.classList.add(ok ? 'good' : 'bad');
      // znepřístupni ostatní možnosti
      Array.prototype.forEach.call(opts.children, function (b) { b.disabled = true; });
      store.record(MODE, ok, ok ? 6 : 0);
      updateStreak();
      ui.sound(ok ? 'correct' : 'wrong');
      card.appendChild(h('div', { class: 'explain ' + (ok ? 'ok' : 'no') },
        h('div', { class: 'explain-head' }, ui.icon(ok ? 'check_circle' : 'warning'), ok ? 'Správně' : 'Pozor'),
        h('div', null, q.explain)
      ));
      card.appendChild(h('button', { class: 'btn primary big', onclick: next }, 'Další situace →'));
    }

    next();
  }

  BILLA.games = BILLA.games || {};
  BILLA.games.scenarios = { title: 'Situace', render: render };
})(window.BILLA = window.BILLA || {});
