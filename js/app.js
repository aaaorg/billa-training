/* =========================================================================
   app.js — router, domovská obrazovka, nastavení (spouští se poslední)
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const ui = BILLA.ui, h = ui.h, store = BILLA.store, games = BILLA.games;
  const root = document.getElementById('app');

  const MODES = [
    { key: 'change',    icon: 'payments',                title: 'Vracení peněz',    desc: 'Spočítej a naskládej drobné', tag: 'NEJDŮLEŽITĚJŠÍ' },
    { key: 'rounding',  icon: 'calculate',               title: 'Zaokrouhlování',   desc: 'Hotovost vs. karta, rychlovka' },
    { key: 'till',      icon: 'account_balance_wallet',  title: 'Počítání zásuvky', desc: 'Sečti pokladnu na konci směny' },
    { key: 'pos',       icon: 'shopping_cart',           title: 'Plná pokladna',    desc: 'Celý nákup od skenu po platbu' },
    { key: 'scenarios', icon: 'quiz',                    title: 'Situace',          desc: 'Jak reagovat u pokladny' }
  ];

  function go(name) {
    window.scrollTo(0, 0);
    // herní obrazovky jedou ve „play" layoutu (vejdou se na výšku displeje bez scrollování)
    root.classList.toggle('play', name !== 'home' && name !== 'settings');
    if (name === 'home') return home();
    if (name === 'settings') return settings();
    const g = games[name];
    if (g) g.render(root);
  }

  function home() {
    ui.clear(root);
    const s = store.state;

    root.appendChild(h('div', { class: 'home-head' },
      h('div', { class: 'logo' },
        h('img', { class: 'logo-billa', src: 'assets/billa-logo-white.svg', alt: 'BILLA', draggable: 'false' }),
        h('span', { class: 'logo-sub' }, 'Neoficiální tréninkový program')),
      h('button', { class: 'gear', 'aria-label': 'Nastavení', onclick: function () { go('settings'); } }, ui.icon('settings'))
    ));

    // přehled postupu: level + XP + nejdelší série
    const lp = store.levelProgress();
    const xpPct = lp.maxed ? 100 : Math.round(lp.into / lp.span * 100);
    root.appendChild(h('div', { class: 'score-strip' },
      h('div', { class: 'score-box' }, h('div', { class: 'score-num' }, String(store.level())), h('div', { class: 'score-lab' }, 'level')),
      h('div', { class: 'score-box' }, h('div', { class: 'score-num' }, String(store.xp)),
        h('div', { class: 'score-lab' }, 'XP'),
        h('div', { class: 'xp-mini' }, h('div', { class: 'xp-mini-fill', style: { width: xpPct + '%' } }))),
      h('div', { class: 'score-box' }, h('div', { class: 'score-num' }, String(bestStreakAll())),
        h('div', { class: 'score-lab' }, 'série ', ui.icon('local_fire_department', { size: 15, fill: true })))
    ));

    const list = h('div', { class: 'mode-list' });
    MODES.forEach(function (m) {
      const acc = store.accuracy(m.key);
      list.appendChild(h('button', { class: 'mode-card', onclick: function () { go(m.key); } },
        h('div', { class: 'mode-icon' }, ui.icon(m.icon)),
        h('div', { class: 'mode-body' },
          h('div', { class: 'mode-title' }, m.title, m.tag ? h('span', { class: 'mode-tag' }, m.tag) : null),
          h('div', { class: 'mode-desc' }, m.desc)),
        h('div', { class: 'mode-meta' }, acc != null ? acc + '%' : ui.icon('chevron_right'))
      ));
    });
    root.appendChild(list);

    root.appendChild(h('div', { class: 'home-foot' },
      'Tip: nejdřív si projeď ', h('b', null, 'Situace'), ', pak piluj ', h('b', null, 'Vracení peněz'),
      '. Appku si můžeš přidat na plochu telefonu a trénovat offline.'));
  }

  function bestStreakAll() {
    let m = 0;
    Object.keys(store.state.stats).forEach(function (k) {
      m = Math.max(m, store.state.stats[k].bestStreak || 0);
    });
    Object.keys(store.state.skills).forEach(function (k) {
      m = Math.max(m, store.state.skills[k].bestStreak || 0);
    });
    return m;
  }

  function settings() {
    ui.clear(root);
    root.appendChild(ui.screenHeader('Nastavení'));
    const st = store.settings;

    function toggle(label, key, sub) {
      const btn = h('button', {
        class: 'set-row' + (st[key] ? ' on' : ''),
        onclick: function () { st[key] = !st[key]; store.save(); this.classList.toggle('on', st[key]); }
      },
        h('div', null, h('div', { class: 'set-lab' }, label), sub ? h('div', { class: 'set-sub' }, sub) : null),
        h('div', { class: 'switch' }, h('div', { class: 'knob' }))
      );
      return btn;
    }

    function modeSeg() {
      const seg = h('div', { class: 'diff-picker' });
      [['row', 'Řádek'], ['fist', 'Hrst']].forEach(function (m) {
        seg.appendChild(h('button', {
          class: 'diff ' + (st.inputMode === m[0] ? 'active' : ''),
          onclick: function () {
            st.inputMode = m[0]; store.save();
            seg.querySelectorAll('.diff').forEach(function (b) { b.classList.remove('active'); });
            this.classList.add('active');
          }
        }, m[1]));
      });
      return seg;
    }

    const card = h('div', { class: 'card' },
      toggle('Zvuky', 'sound'),
      toggle('Vibrace', 'haptics'),
      h('div', { class: 'set-row static' },
        h('div', { class: 'set-lab' }, 'Počítání přijaté hotovosti'),
        h('div', { class: 'set-sub' }, 'Řádek = srovnané kusy · Hrst = odsouváš je po jednom'),
        modeSeg()),
      h('div', { class: 'set-row static' },
        h('div', { class: 'set-lab' }, 'Výchozí obtížnost (strop)'),
        h('div', { class: 'set-sub' }, 'Uvnitř se obtížnost sama přizpůsobí tomu, jak ti to jde'),
        ui.difficultyPicker(null)),
      h('button', { class: 'btn danger', onclick: function () {
        if (confirm('Opravdu smazat veškerý postup a body?')) { store.reset(); ui.toast('Postup smazán'); go('settings'); }
      } }, 'Vynulovat postup')
    );
    root.appendChild(card);

    root.appendChild(h('div', { class: 'home-foot' },
      'BILLA pokladní trenažér · verze 1.0 · vše běží jen ve tvém zařízení.'));
  }

  BILLA.app = { go: go };

  // registrace service workeru pro offline (jen přes http/https)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    // jakmile převezme řízení nová verze SW, jednou obnov stránku (= aktuální verze i na mobilu)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        if (reg.update) { try { reg.update(); } catch (e) {} }
      }).catch(function () {});
    });
  }

  // start
  go('home');
})(window.BILLA = window.BILLA || {});
