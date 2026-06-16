/* =========================================================================
   games/change.js — Vracení peněz (refactor: lekce + adaptivní obtížnost + šuplík)
   Tok jednoho zákazníka:
     1) Pokladna ukáže částku k úhradě.
     2) Zákazník PODÁ hotovost → spočítej ji (režim Řádek / Hrst) a zadej.
     3) Přijatá hotovost se ULOŽÍ do šuplíku.
     4) Pokladna ukáže, kolik vrátit → ODPOČÍTEJ drobné ZE ŠUPLÍKU.
        Když nejdou složit přesně → zavolej vedoucí (rozměnění).
   Lekce = N zákazníků na JEDEN šuplík. Obtížnost se sama kalibruje.
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const ui = BILLA.ui, money = BILLA.money, h = ui.h, store = BILLA.store;
  const diff = BILLA.difficulty, drawerApi = BILLA.drawer;
  const MODE = 'change';

  /* ============ LADITELNÉ KONSTANTY ============ */
  const XP = {
    base: 5,          // základ XP za kolo
    perL: 2,          // přídavek za úroveň L
    retryMult: 0.6,   // násobič, když to vyšlo až na druhý pokus
    revealXp: 2,      // útěšné XP, když se výsledek musel odhalit
    minimalBonus: 0.5,// bonus za vrácení na nejmenší počet kusů (+50 %)
    managerMult: 0.5  // násobič části za vrácení, když se volala vedoucí
  };
  const SHIELDS = 1;  // kolik chyb za lekci „odpustí" série (štít)
  /* ============================================= */

  function render(root) {
    ui.clear(root);
    root.appendChild(ui.screenHeader('Vracení peněz', 'Přijmi hotovost · ulož do šuplíku · vrať nazpět'));

    const tier = store.settings.difficulty;
    const sk = store.skill(MODE);
    const LEN = store.settings.lessonLen || 8;

    // stav lekce
    let L = diff.clampToBand(sk.L || diff.startL(tier), tier);
    let drawer = drawerApi.create();
    let idx = 0, correctCount = 0, lessonXp = 0, streak = 0, shields = SHIELDS;
    let errs = {};        // počty chyb podle typu (slabé místo)
    let maxChange = 0;    // pro odznak
    let round = null;     // aktuální zákazník + příznaky kola

    const bar = h('div', { class: 'play-bar lesson-bar' });
    const card = h('div', { class: 'card stage' });
    root.appendChild(bar);
    root.appendChild(card);

    drawBar();
    showIntro();

    /* ---------- horní lišta lekce ---------- */
    function drawBar() {
      ui.clear(bar);
      const dots = h('div', { class: 'lesson-dots' });
      for (let i = 0; i < LEN; i++) {
        dots.appendChild(h('span', { class: 'ldot' + (i < idx ? ' done' : i === idx ? ' now' : '') }));
      }
      const mode = store.settings.inputMode || 'row';
      const toggle = h('button', {
        class: 'mode-toggle', 'aria-label': 'Přepnout režim počítání',
        onclick: function () {
          store.settings.inputMode = (mode === 'fist') ? 'row' : 'fist';
          store.save(); drawBar();
          if (round && round.stage === 'count') drawCount();
        }
      }, ui.icon(mode === 'fist' ? 'payments' : 'view_agenda', { size: 18 }),
        mode === 'fist' ? 'Hrst' : 'Řádek');

      bar.appendChild(h('div', { class: 'lesson-left' },
        h('span', { class: 'lvl-chip' }, 'Úroveň ' + Math.round(L)), dots));
      bar.appendChild(h('div', { class: 'lesson-right' }, toggle,
        h('div', { class: 'streak' },
          h('span', { class: 'streak-num' }, String(streak)),
          ui.icon('local_fire_department', { fill: true, cls: 'streak-fire' }))));
    }

    /* ---------- úvod lekce ---------- */
    function showIntro() {
      round = null;
      ui.clear(card);
      card.appendChild(h('div', { class: 'intro' },
        h('div', { class: 'intro-ico' }, ui.icon('shopping_cart')),
        h('h3', { class: 'intro-title' }, 'Směna začíná'),
        h('p', { class: 'intro-sub' }, LEN + ' zákazníků · jeden šuplík na celou lekci · vrať vždy přesně.'),
        h('div', { class: 'intro-tips' },
          tip('payments', 'Přijatou hotovost spočítej a ulož do šuplíku.'),
          tip('account_balance_wallet', 'Drobné vracíš ze šuplíku — hospodař, ať nedojdou.'),
          tip('verified_user', 'Když nejde vrátit přesně, zavolej vedoucí na rozměnění.')),
        h('button', { class: 'btn primary big', onclick: startRound }, 'Spustit směnu →')));
    }
    function tip(ic, txt) { return h('div', { class: 'tip' }, ui.icon(ic, { size: 20 }), h('span', null, txt)); }

    /* ---------- jeden zákazník ---------- */
    function startRound() {
      const cust = diff.genCustomer(L);
      round = {
        cust: cust, stage: 'count', typed: '', attempts: 0, giveAttempts: 0,
        countError: false, changeError: false, usedManager: false, efficient: true, built: []
      };
      drawBar();
      drawCount();
    }

    function registerPanel(extra) {
      return h('div', { class: 'register' }, h('div', { class: 'reg-screen' },
        h('div', { class: 'reg-row' }, h('span', null, 'K ÚHRADĚ'),
          h('span', { class: 'reg-due' }, money.formatKc(round.cust.total))),
        extra));
    }

    function group(list) {
      const obj = {};
      list.forEach(function (d) { obj[d] = (obj[d] || 0) + 1; });
      return Object.keys(obj).map(Number).sort(function (a, b) { return b - a; })
        .map(function (d) { return { denom: d, count: obj[d] }; });
    }

    /* --- krok 1: spočítej přijatou hotovost --- */
    function drawCount() {
      ui.clear(card);
      round.stage = 'count';
      const mode = store.settings.inputMode || 'row';
      card.appendChild(registerPanel());
      card.appendChild(h('div', { class: 'pile-label' }, ui.icon('account_balance_wallet'),
        'Zákazník ti podal — spočítej, kolik ti dal:'));
      if (mode === 'fist') drawFist();
      else { card.appendChild(h('div', { class: 'pile' }, ui.pileRow(group(round.cust.pieces), { size: 'md' }))); countInput(); }
    }

    function countInput() {
      round.typed = '';
      card.appendChild(h('div', { class: 'q small center' }, 'Zadej přijatou částku:'));
      const disp = h('div', { class: 'big-input' }, '0 Kč');
      card.appendChild(disp);
      card.appendChild(ui.numpad(function (k) {
        if (k === 'back') round.typed = round.typed.slice(0, -1);
        else if (k === 'enter') return submitCount();
        else if (round.typed.length < 6) round.typed = (round.typed === '0' ? '' : round.typed) + k;
        disp.textContent = (round.typed || '0') + ' Kč';
      }));
    }

    /* --- režim Hrst: rozházené kusy, odsouváš je po jednom --- */
    function drawFist() {
      const pieces = round.cust.pieces.slice();
      const hint = h('div', { class: 'fist-hint' },
        'Odsuň každý kus pryč a počítej v hlavě · zbývá ', h('b', { class: 'fist-left' }, String(pieces.length)));
      const area = h('div', { class: 'fist-area' });
      card.appendChild(hint);
      card.appendChild(area);
      const leftEl = hint.querySelector('.fist-left');
      let remaining = pieces.length;
      if (!remaining) { countInput(); return; }

      pieces.forEach(function (d, i) {
        const el = ui.denomEl(d, { size: 'md' });
        el.classList.add('fist-piece');
        el.style.left = (8 + Math.random() * 62).toFixed(1) + '%';
        el.style.top = (6 + Math.random() * 56).toFixed(1) + '%';
        el.style.setProperty('--rot', (Math.random() * 40 - 20).toFixed(1) + 'deg');
        el.style.zIndex = String(10 + i);
        el.style.touchAction = 'none';
        makeSwipable(el, function () {
          remaining--; leftEl.textContent = String(remaining); ui.sound('coin');
          if (remaining <= 0) { area.classList.add('cleared'); countInput(); }
        });
        area.appendChild(el);
      });
    }

    function makeSwipable(el, onGone) {
      let sx = 0, sy = 0, active = false, gone = false;
      el.addEventListener('pointerdown', function (e) {
        if (gone) return; active = true; sx = e.clientX; sy = e.clientY;
        el.style.transition = 'none';
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
      });
      el.addEventListener('pointermove', function (e) {
        if (!active || gone) return;
        el.style.transform = 'translate(' + (e.clientX - sx) + 'px,' + (e.clientY - sy) + 'px) rotate(var(--rot))';
      });
      function release(e) {
        if (!active || gone) return; active = false;
        let dx = (e.clientX || sx) - sx, dy = (e.clientY || sy) - sy;
        if (Math.hypot(dx, dy) < 10) { dx = (Math.random() * 2 - 1) * 80; dy = -90; } // ťuk → vyhoď nahoru
        gone = true;
        el.style.transition = 'transform .34s ease, opacity .34s ease';
        el.style.transform = 'translate(' + (dx * 5) + 'px,' + (dy * 5 - 30) + 'px) rotate(var(--rot))';
        el.style.opacity = '0';
        setTimeout(function () { el.remove(); }, 330);
        onGone();
      }
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
    }

    function submitCount() {
      const c = round.cust;
      const val = parseInt(round.typed || '0', 10);
      if (val === c.tendered) {
        drawerApi.addPieces(drawer, c.pieces);          // ulož přijatou hotovost
        if (c.change > 0) { round.stage = 'give'; drawGive(); }
        else finishRound();
      } else {
        round.attempts++;
        if (round.attempts < 2) {
          ui.feedback(false, 'Přepočítej', 'Je tam ' + (val < c.tendered ? 'víc' : 'míň') + ', než myslíš. Zkus to znovu.');
          const disp = card.querySelector('.big-input');
          round.typed = ''; if (disp) disp.textContent = '0 Kč';
        } else {
          round.countError = true; errs.count = (errs.count || 0) + 1;
          drawerApi.addPieces(drawer, c.pieces);
          ui.feedback(false, 'Dal ti ' + money.formatKc(c.tendered), 'Příště počítej pomalu po nominálech.');
          setTimeout(function () {
            if (c.change > 0) { round.stage = 'give'; drawGive(); } else finishRound();
          }, 1400);
        }
      }
    }

    /* --- krok 2: odpočítej drobné ZE ŠUPLÍKU --- */
    function drawGive() {
      ui.clear(card);
      const change = round.cust.change;
      maxChange = Math.max(maxChange, change);

      card.appendChild(registerPanel(
        h('div', { class: 'reg-row change' }, h('span', null, 'VRÁTIT'),
          h('span', { class: 'reg-change' }, money.formatKc(change)))));
      card.appendChild(h('div', { class: 'q small' }, 'Odpočítej ', h('b', null, money.formatKc(change)), ' ze šuplíku:'));

      const builtBox = h('div', { class: 'built' });
      card.appendChild(builtBox);

      card.appendChild(h('div', { class: 'tray-label' }, ui.icon('account_balance_wallet', { size: 18 }), 'Šuplík'));
      const tray = h('div', { class: 'drawer-tray' });
      card.appendChild(tray);

      const managerBtn = h('button', { class: 'btn ghost manager', onclick: callManager },
        ui.icon('verified_user'), 'Zavolat vedoucí (rozměnit)');
      card.appendChild(managerBtn);
      card.appendChild(h('div', { class: 'build-actions' },
        h('button', { class: 'btn ghost', onclick: returnAll }, 'Vrátit zpět'),
        h('button', { class: 'btn primary', onclick: submitGive }, 'Vrátit zákazníkovi')));

      function builtSum() { return round.built.reduce(function (s, d) { return s + d; }, 0); }

      function redrawBuilt() {
        ui.clear(builtBox);
        if (!round.built.length) builtBox.appendChild(h('span', { class: 'muted' }, 'Ber ze šuplíku…'));
        round.built.forEach(function (d, i) {
          builtBox.appendChild(ui.denomEl(d, { size: 'sm', clickable: true, onClick: function () {
            round.built.splice(i, 1); drawerApi.add(drawer, d, 1); redraw();
          } }));
        });
      }

      function redrawTray() {
        ui.clear(tray);
        money.DENOMS.forEach(function (d) {
          if (d > change) return; // větší nominál na tohle vrácení nepoužiješ
          const avail = drawerApi.count(drawer, d);
          const slot = h('div', { class: 'tray-slot' + (avail === 0 ? ' empty' : '') },
            ui.denomEl(d, { size: 'md', clickable: avail > 0, onClick: avail > 0 ? function () {
              if (drawerApi.take(drawer, d, 1)) { ui.sound('coin'); round.built.push(d); redraw(); }
            } : null }),
            h('span', { class: 'tray-count' }, '×' + avail));
          tray.appendChild(slot);
        });
      }

      function updateManager() {
        const need = change - builtSum();
        managerBtn.classList.toggle('urge', need > 0 && !drawerApi.canMake(drawer, need));
      }

      function redraw() { redrawBuilt(); redrawTray(); updateManager(); }

      function returnAll() {
        round.built.forEach(function (d) { drawerApi.add(drawer, d, 1); });
        round.built = []; redraw();
      }
      function callManager() {
        drawerApi.refill(drawer);
        round.usedManager = true; errs.manager = (errs.manager || 0) + 1;
        ui.toast('Vedoucí přinesla drobné do šuplíku.'); redraw();
      }
      function submitGive() {
        const s = builtSum();
        if (s === change) {
          const minimal = money.totalPieces(money.makeChange(change));
          round.efficient = round.built.length <= minimal;
          if (!round.efficient) errs.efficiency = (errs.efficiency || 0) + 1;
          finishRound();
          return;
        }
        // špatně → diagnóza (bez prozrazení součtu napoprvé), druhý pokus, pak odhalení
        round.giveAttempts = (round.giveAttempts || 0) + 1;
        if (round.giveAttempts < 2) {
          ui.feedback(false, 'Není to přesně', 'Vrátila jsi ' + (s < change ? 'míň' : 'víc') + ', než máš — přepočítej a oprav.');
        } else {
          round.changeError = true; errs.change = (errs.change || 0) + 1;
          ui.feedback(false, 'Mělo být ' + money.formatKc(change), 'Příště si drobné v duchu sčítej po nominálech.');
          setTimeout(finishRound, 1600);
        }
      }

      redraw();
    }

    /* ---------- konec kola: skóre, série, adaptace ---------- */
    function finishRound() {
      const r = round, c = r.cust;
      const failed = r.countError || r.changeError;
      let outcome;
      if (failed) outcome = 'bad';
      else if (r.attempts > 0 || r.giveAttempts > 0 || r.usedManager || !r.efficient) outcome = 'ok';
      else outcome = 'good';

      // XP
      const baseXp = XP.base + XP.perL * L;
      let earned = baseXp * (r.countError ? 0 : (r.attempts > 0 ? XP.retryMult : 1));
      if (c.change > 0 && !r.changeError) {
        earned += baseXp * (r.usedManager ? XP.managerMult
          : (r.giveAttempts > 0 ? XP.retryMult : (r.efficient ? 1 + XP.minimalBonus : 1)));
      }
      let gained = Math.round(earned);
      if (failed) gained = Math.max(gained, XP.revealXp);
      lessonXp += gained;

      // série + štíty
      if (outcome === 'bad') { if (shields > 0) shields--; else streak = 0; }
      else streak++;
      if (streak > (sk.bestStreak || 0)) sk.bestStreak = streak;
      if (!failed) correctCount++;

      // mistrovství (klouzavě)
      const tgt = outcome === 'good' ? Math.min(100, Math.round(L / 12 * 100) + 10)
        : outcome === 'bad' ? Math.max(0, sk.mastery - 18) : sk.mastery;
      sk.mastery = Math.round(sk.mastery * 0.85 + tgt * 0.15);

      // adaptace úrovně
      L = diff.nextL(L, outcome, tier);
      sk.L = L;

      // zápis: XP do účtu + legacy statistika (kvůli domovské)
      const lvl = store.addXp(gained);
      store.record(MODE, !failed, 0);

      // zpětná vazba kola
      const okIsh = outcome !== 'bad';
      let msg = okIsh ? (outcome === 'good' ? 'Výborně!' : (r.usedManager ? 'Vyřešeno' : 'Správně')) : 'Pokračuj';
      let sub = (outcome === 'ok' && !r.efficient && c.change > 0 ? 'Šlo to na míň kusů · ' : '') + '+' + gained + ' XP';
      ui.feedback(okIsh, msg, sub);
      if (lvl.leveledUp) setTimeout(function () { ui.toast('Level up! Úroveň ' + lvl.level); }, 950);

      idx++; drawBar();
      setTimeout(function () { idx >= LEN ? showSummary() : startRound(); }, okIsh ? 950 : 1500);
    }

    /* ---------- souhrn lekce ---------- */
    function showSummary() {
      round = null;
      sk.lessonsDone = (sk.lessonsDone || 0) + 1;
      store.save();
      ui.clear(card);

      const stars = correctCount >= LEN ? 3 : correctCount >= Math.ceil(LEN * 0.75) ? 2 : 1;
      let weak = null, wn = 0;
      Object.keys(errs).forEach(function (k) { if (errs[k] > wn) { wn = errs[k]; weak = k; } });
      const weakMsg = {
        count: 'Pozor na počítání přijaté hotovosti — počítej pomalu po nominálech.',
        change: 'Vrácená částka občas neseděla — drobné si v duchu sčítej po kusech, než je podáš.',
        manager: 'Často docházely drobné — zkus vracet tak, abys šetřila malé mince.',
        efficiency: 'Zkus vracet na nejmenší počet kusů.'
      };
      const lp = store.levelProgress();
      const xpPct = lp.maxed ? 100 : Math.round(lp.into / lp.span * 100);

      card.appendChild(h('div', { class: 'summary' },
        h('div', { class: 'sum-stars' }, '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars)),
        h('h3', { class: 'intro-title' }, 'Směna hotová'),
        h('div', { class: 'sum-stat-grid' },
          stat(correctCount + '/' + LEN, 'správně'),
          stat('+' + lessonXp, 'XP za lekci'),
          stat(String(sk.bestStreak || 0), 'nejdelší série')),
        h('div', { class: 'sum-line' }, 'Level ' + lp.level + (lp.maxed ? ' (max)' : '')),
        progressBar(xpPct, 'xp'),
        h('div', { class: 'sum-line' }, 'Mistrovství vracení ', h('b', null, sk.mastery + ' %'),
          ' · úroveň ' + Math.round(L)),
        progressBar(sk.mastery, 'mastery'),
        h('div', { class: 'sum-line muted' }, 'V šuplíku zůstalo ' + money.formatKc(drawerApi.total(drawer))),
        weak ? h('div', { class: 'sum-tip' }, ui.icon('lightbulb', { size: 18 }), weakMsg[weak]) : null,
        h('div', { class: 'sum-actions' },
          h('button', { class: 'btn ghost', onclick: function () { BILLA.app.go('home'); } }, 'Domů'),
          h('button', { class: 'btn primary', onclick: function () { render(root); } }, 'Další lekce →'))));

      if (correctCount >= LEN && store.award('change_flawless')) ui.toast('🏅 Odznak: Bezchybná směna!');
      if (maxChange >= 1000 && correctCount >= Math.ceil(LEN * 0.75) && store.award('change_bigpro')) ui.toast('🏅 Odznak: Velké vracení zvládnuté!');
    }
    function stat(num, lab) { return h('div', { class: 'sum-stat' }, h('div', { class: 'sum-num' }, num), h('div', { class: 'sum-lab' }, lab)); }
    function progressBar(p, cls) {
      return h('div', { class: 'prog-bar ' + cls }, h('div', { class: 'prog-fill', style: { width: Math.max(2, Math.min(100, p)) + '%' } }));
    }
  }

  BILLA.games = BILLA.games || {};
  BILLA.games.change = { title: 'Vracení peněz', render: render };
})(window.BILLA = window.BILLA || {});
