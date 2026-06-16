/* =========================================================================
   games/change.js — Vracení peněz (realistický tok jako u skutečné pokladny)
   1) Pokladna ukáže částku k úhradě.
   2) Zákazník podá hotovost → SPOČÍTEJ ji a zadej do pokladny.
   3) Pokladna spočítá a ukáže, kolik vrátit.
   4) ODPOČÍTEJ drobné nazpět z pokladny.
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const ui = BILLA.ui, money = BILLA.money, h = ui.h, store = BILLA.store;
  const MODE = 'change';

  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // jak rozdělit jeden nominál na menší (pro „rozházenou" hrst od zákazníka)
  const SPLITS = {
    2: [1, 1], 5: [2, 2, 1], 10: [5, 5], 20: [10, 10], 50: [20, 20, 10],
    100: [50, 50], 200: [100, 100], 500: [200, 200, 100], 1000: [500, 500],
    2000: [1000, 1000], 5000: [2000, 2000, 1000]
  };

  function chooseTender(total, diff) {
    const notes = [50, 100, 200, 500, 1000, 2000];
    const nextNote = notes.find(function (n) { return n >= total; }) || Math.ceil(total / 1000) * 1000;
    let t;
    if (diff === 1) t = pick([nextNote, Math.ceil((total + 1) / 10) * 10, Math.ceil((total + 1) / 50) * 50]);
    else if (diff === 2) t = pick([nextNote, Math.ceil((total + 1) / 100) * 100, total + pick([10, 20, 50])]);
    else t = pick([nextNote, Math.ceil((total + 1) / 100) * 100, total + pick([3, 7, 13, 23, 50]), nextNote + pick([0, 50, 100])]);
    if (Math.random() < 0.08) t = total; // občas přesně → nevrací se nic
    if (t < total) t = total + pick([1, 2, 5, 10]);
    return t;
  }

  // hrst, kterou zákazník fyzicky podá (objekt denom->count)
  function buildPile(tendered, diff) {
    const obj = {};
    money.makeChange(tendered).forEach(function (b) { obj[b.denom] = b.count; });
    const fragments = diff === 1 ? rnd(0, 1) : diff === 2 ? rnd(1, 2) : rnd(2, 4);
    for (let i = 0; i < fragments; i++) {
      const present = Object.keys(obj).filter(function (d) { return obj[d] > 0 && SPLITS[d]; });
      if (!present.length) break;
      const pieces = Object.keys(obj).reduce(function (s, d) { return s + obj[d]; }, 0);
      if (pieces >= 8) break;
      const d = pick(present);
      obj[d]--; if (obj[d] === 0) delete obj[d];
      SPLITS[d].forEach(function (x) { obj[x] = (obj[x] || 0) + 1; });
    }
    return Object.keys(obj).map(Number).sort(function (a, b) { return b - a; })
      .map(function (d) { return { denom: d, count: obj[d] }; });
  }

  function generate(diff) {
    const total = diff === 1 ? rnd(5, 95) : diff === 2 ? rnd(15, 380) : rnd(40, 940);
    const tendered = chooseTender(total, diff);
    return { total: total, tendered: tendered, change: tendered - total, pile: buildPile(tendered, diff) };
  }

  function render(root) {
    ui.clear(root);
    let round = null, stage = 'count', typed = '', built = [];

    root.appendChild(ui.screenHeader('Vracení peněz', 'Spočítej hotovost · pokladna řekne kolik vrátit · odpočítej'));
    const stat = store.modeStats(MODE);
    root.appendChild(h('div', { class: 'play-bar' },
      ui.difficultyPicker(function () { newRound(); }),
      h('div', { class: 'streak' }, h('span', { class: 'streak-num', id: 'streak' }, String(stat.streak)),
        ui.icon('local_fire_department', { fill: true, cls: 'streak-fire' }))
    ));

    const card = h('div', { class: 'card stage' });
    root.appendChild(card);

    function updateStreak() { const e = document.getElementById('streak'); if (e) e.textContent = String(store.modeStats(MODE).streak); }

    function newRound() { round = generate(store.settings.difficulty); stage = 'count'; typed = ''; built = []; draw(); }

    function registerPanel(extra) {
      return h('div', { class: 'register' },
        h('div', { class: 'reg-screen' },
          h('div', { class: 'reg-row' }, h('span', null, 'K ÚHRADĚ'), h('span', { class: 'reg-due' }, money.formatKc(round.total))),
          extra
        )
      );
    }

    function draw() {
      ui.clear(card);
      if (stage === 'count') drawCount();
      else if (stage === 'change') drawChange();
      else if (stage === 'done') drawDone();
    }

    /* --- 1) spočítej přijatou hotovost --- */
    function drawCount() {
      card.appendChild(registerPanel());
      card.appendChild(h('div', { class: 'pile-label' }, ui.icon('account_balance_wallet'), 'Zákazník ti podal — spočítej kusy:'));
      card.appendChild(h('div', { class: 'pile' }, ui.pileRow(round.pile, { size: 'md' })));
      card.appendChild(h('div', { class: 'q' }, 'Spočítej a zadej, kolik ti dal:'));
      const disp = h('div', { class: 'big-input' }, '0 Kč');
      card.appendChild(disp);
      card.appendChild(ui.numpad(function (k) {
        if (k === 'back') typed = typed.slice(0, -1);
        else if (k === 'enter') return submitCount();
        else if (typed.length < 6) typed = (typed === '0' ? '' : typed) + k;
        disp.textContent = (typed || '0') + ' Kč';
      }));
    }

    function submitCount() {
      const val = parseInt(typed || '0', 10);
      if (val === round.tendered) {
        if (round.change > 0 && store.settings.buildStep) {
          ui.feedback(true, 'Správně spočítáno!', 'Pokladna teď ukáže, kolik vrátit.');
          setTimeout(function () { stage = 'change'; built = []; draw(); }, 800);
        } else {
          // bez skládání: jen ukáže částku k vrácení
          store.record(MODE, true, round.change > 0 ? 8 : 6);
          updateStreak();
          ui.feedback(true, round.change > 0 ? 'Vrať ' + money.formatKc(round.change) : 'Přesně — nevracíš nic', '');
          setTimeout(function () { stage = 'done'; draw(); }, 1000);
        }
      } else {
        ui.feedback(false, 'Zákazník dal ' + money.formatKc(round.tendered), 'Přepočítej hrst pozorně po nominálech.');
        store.record(MODE, false, 0);
        updateStreak();
        setTimeout(function () { stage = 'done'; draw(); }, 1500);
      }
    }

    /* --- 2) odpočítej drobné nazpět --- */
    function drawChange() {
      card.appendChild(registerPanel(
        h('div', { class: 'reg-row change' }, h('span', null, 'VRÁTIT'), h('span', { class: 'reg-change' }, money.formatKc(round.change)))
      ));
      card.appendChild(h('div', { class: 'q' }, 'Odpočítej ', h('b', null, money.formatKc(round.change)), ' z pokladny:'));

      const builtBox = h('div', { class: 'built' });
      const sumLine = h('div', { class: 'built-sum' });
      card.appendChild(builtBox);
      card.appendChild(sumLine);
      function builtSum() { return built.reduce(function (s, d) { return s + d; }, 0); }
      function redraw() {
        ui.clear(builtBox);
        if (!built.length) builtBox.appendChild(h('span', { class: 'muted' }, 'Klepej na mince a bankovky…'));
        built.forEach(function (d, i) {
          builtBox.appendChild(ui.denomEl(d, { size: 'sm', clickable: true, onClick: function () { built.splice(i, 1); redraw(); } }));
        });
        const s = builtSum();
        sumLine.textContent = 'Odpočítáno: ' + money.formatKc(s) + (s !== round.change
          ? (s < round.change ? '  (chybí ' + money.formatKc(round.change - s) + ')' : '  (přebývá ' + money.formatKc(s - round.change) + ')') : '');
        sumLine.className = 'built-sum' + (s === round.change ? ' ok' : s > round.change ? ' over' : '');
      }
      redraw();

      const palette = h('div', { class: 'palette' });
      money.DENOMS.slice().reverse().forEach(function (d) {
        if (d > round.change) return;
        palette.appendChild(ui.denomEl(d, { size: 'md', clickable: true, onClick: function () { ui.sound('coin'); built.push(d); redraw(); } }));
      });
      card.appendChild(palette);
      card.appendChild(h('div', { class: 'build-actions' },
        h('button', { class: 'btn ghost', onclick: function () { built = []; redraw(); } }, 'Vymazat'),
        h('button', { class: 'btn primary', onclick: function () { submitBuild(builtSum()); } }, 'Vrátit zákazníkovi')
      ));
    }

    function submitBuild(sum) {
      if (sum !== round.change) { ui.feedback(false, 'Musí sedět přesně ' + money.formatKc(round.change)); return; }
      const minimal = money.totalPieces(money.makeChange(round.change));
      const efficient = built.length <= minimal;
      const pts = 8 + 10 + (efficient ? 5 : 0);
      store.record(MODE, true, pts);
      updateStreak();
      ui.feedback(true, 'Vráceno správně!', efficient ? 'Nejmíň kusů (' + built.length + '). +' + pts + ' b.' : 'Šlo to i na ' + minimal + ' ks. +' + pts + ' b.');
      setTimeout(function () { stage = 'done'; draw(); }, 900);
    }

    /* --- shrnutí kola --- */
    function drawDone() {
      card.appendChild(h('div', { class: 'done ok' },
        h('div', { class: 'done-ico' }, ui.icon('receipt_long')),
        h('div', { class: 'done-txt' },
          h('div', { class: 'q' }, 'Dal ', h('b', null, money.formatKc(round.tendered)), ', platil ', h('b', null, money.formatKc(round.total))),
          h('div', { class: 'mini-lab' }, round.change > 0 ? 'Správně vrátit ' + money.formatKc(round.change) + ' nejjednodušeji:' : 'Přesná částka — nevrací se nic.'),
          round.change > 0 ? ui.pileRow(money.makeChange(round.change), { size: 'sm' }) : null
        )
      ));
      card.appendChild(h('button', { class: 'btn primary big', onclick: newRound }, 'Další zákazník →'));
    }

    newRound();
  }

  BILLA.games = BILLA.games || {};
  BILLA.games.change = { title: 'Vracení peněz', render: render };
})(window.BILLA = window.BILLA || {});
