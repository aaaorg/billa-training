/* =========================================================================
   games/rounding.js — Zaokrouhlování (hotovost vs. karta), rychlovka
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const ui = BILLA.ui, money = BILLA.money, h = ui.h, store = BILLA.store;
  const MODE = 'rounding';

  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function generate() {
    // cena s desetinnou koncovkou
    const base = rnd(8, 950);
    const cents = pick([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.9, 0.9, 0.5]);
    const total = base + cents;
    const card = Math.random() < 0.35; // občas se zeptáme na platbu kartou
    const correct = card ? total : money.roundCashKc(total);
    // možnosti: správná + dvě blízké
    const opts = new Set([correct]);
    opts.add(Math.floor(total)); opts.add(Math.ceil(total));
    opts.add(money.roundCashKc(total)); opts.add(total);
    const arr = Array.from(opts).filter(function (v) { return v >= 0; });
    // promíchat a vzít max 3 včetně správné
    const others = arr.filter(function (v) { return v !== correct; });
    shuffle(others);
    const choices = [correct, others[0], others[1]].filter(function (v) { return v != null; });
    shuffle(choices);
    return { total: total, card: card, correct: correct, choices: choices };
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
  }

  function render(root) {
    ui.clear(root);
    root.appendChild(ui.screenHeader('Zaokrouhlování', 'Hotovost na celé koruny, karta přesně'));

    const stat = store.modeStats(MODE);
    root.appendChild(h('div', { class: 'play-bar' },
      h('div', { class: 'hint-chip' }, 'Hotovost → celé Kč · Karta → přesně'),
      h('div', { class: 'streak' }, h('span', { class: 'streak-num', id: 'streak' }, String(stat.streak)),
        ui.icon('local_fire_department', { fill: true, cls: 'streak-fire' }))
    ));

    const card = h('div', { class: 'card stage' });
    root.appendChild(card);
    let round = null, locked = false;

    function updateStreak() {
      document.getElementById('streak').textContent = String(store.modeStats(MODE).streak);
    }

    function next() {
      round = generate(); locked = false;
      ui.clear(card);
      card.appendChild(h('div', { class: 'pay-badge ' + (round.card ? 'card' : 'cash') },
        ui.icon(round.card ? 'credit_card' : 'payments'),
        round.card ? 'Platba KARTOU' : 'Platba HOTOVĚ'));
      card.appendChild(h('div', { class: 'q center' }, 'Na účtence je ', h('b', null, money.formatKc(round.total, { decimals: 2 }))));
      card.appendChild(h('div', { class: 'q center small' }, 'Kolik zákazník zaplatí?'));

      const opts = h('div', { class: 'choices' });
      round.choices.forEach(function (c) {
        opts.appendChild(h('button', {
          class: 'btn choice',
          onclick: function () { answer(c, this); }
        }, money.formatKc(c, { decimals: Number.isInteger(c) ? 0 : 2 })));
      });
      card.appendChild(opts);
    }

    function answer(val, btn) {
      if (locked) return;
      locked = true;
      const ok = val === round.correct;
      btn.classList.add(ok ? 'good' : 'bad');
      store.record(MODE, ok, ok ? 3 : 0);
      updateStreak();
      const why = round.card
        ? 'Karta se nezaokrouhluje → přesně ' + money.formatKc(round.correct, { decimals: 2 })
        : money.formatKc(round.total, { decimals: 2 }) + ' → ' + money.formatKc(round.correct) + ' (matematicky)';
      ui.feedback(ok, ok ? 'Správně!' : 'Mělo být ' + money.formatKc(round.correct, { decimals: Number.isInteger(round.correct) ? 0 : 2 }), why);
      setTimeout(next, ok ? 850 : 1700);
    }

    next();
  }

  BILLA.games = BILLA.games || {};
  BILLA.games.rounding = { title: 'Zaokrouhlování', render: render };
})(window.BILLA = window.BILLA || {});
