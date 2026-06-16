/* =========================================================================
   ui.js — pomocné funkce pro DOM, zvuky, haptiku, vizuální mince/bankovky
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const money = BILLA.money;
  const META = BILLA.data.DENOM_META;

  /* ---- tvorba DOM ---- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'style' && typeof v === 'object') {
          for (const sk in v) {
            if (sk.charAt(0) === '-') e.style.setProperty(sk, v[sk]); // CSS proměnné (--c1)
            else e.style[sk] = v[sk];
          }
        }
        else if (k === 'html') e.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          e.addEventListener(k.slice(2).toLowerCase(), v);
        } else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      e.appendChild((typeof kid === 'string' || typeof kid === 'number')
        ? document.createTextNode(String(kid)) : kid);
    }
    return e;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  /* ---- ikona (vložené SVG Material Symbols Rounded — funguje i offline) ---- */
  // opts: { size:Number|String, cls:String }
  const ICONS = BILLA.icons || {};
  function icon(name, opts) {
    opts = opts || {};
    const inner = ICONS[name] || '';
    const svg = '<svg viewBox="0 -960 960 960" width="1em" height="1em" fill="currentColor" '
      + 'aria-hidden="true" focusable="false">' + inner + '</svg>';
    const e = h('span', { class: 'material-symbols-rounded' + (opts.cls ? ' ' + opts.cls : ''), html: svg });
    if (opts.size != null) e.style.fontSize = typeof opts.size === 'number' ? opts.size + 'px' : opts.size;
    return e;
  }

  /* ---- zvuky (Web Audio, bez externích souborů) ---- */
  let actx = null;
  function ctx() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) actx = new AC();
    }
    return actx;
  }
  function tone(freq, start, dur, gain) {
    const c = ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = freq; o.type = 'sine';
    o.connect(g); g.connect(c.destination);
    const t = c.currentTime + start;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain || 0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function sound(name) {
    if (!BILLA.store.settings.sound) return;
    try {
      if (name === 'correct') { tone(660, 0, 0.12); tone(990, 0.1, 0.18); }
      else if (name === 'wrong') { tone(220, 0, 0.25, 0.22); tone(160, 0.12, 0.25, 0.22); }
      else if (name === 'tap') { tone(520, 0, 0.05, 0.1); }
      else if (name === 'coin') { tone(880, 0, 0.05, 0.08); tone(1320, 0.04, 0.06, 0.06); }
      else if (name === 'cash') { tone(440, 0, 0.06, 0.12); tone(550, 0.06, 0.06, 0.12); tone(660, 0.12, 0.1, 0.12); }
    } catch (e) {}
  }
  function vibrate(ms) {
    if (BILLA.store.settings.haptics && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  /* ---- vizuální mince / bankovka (reálné obrázky) ---- */
  // size: 'sm' | 'md' | 'lg'
  function denomEl(denom, opts) {
    opts = opts || {};
    const m = META[denom];
    const size = opts.size || 'md';
    const cls = 'denom ' + m.type + (m.type === 'coin' ? ' cs' + m.scale : '') + ' ' + size + (opts.clickable ? ' clickable' : '');
    const img = h('img', { class: m.type + '-img', src: m.img, alt: denom + ' Kč', draggable: 'false', loading: 'lazy' });
    const node = h('div', { class: cls, title: denom + ' Kč' }, img);
    if (opts.count && opts.count > 1) {
      node.appendChild(h('span', { class: 'denom-count' }, '×' + opts.count));
    }
    if (opts.onClick) {
      node.addEventListener('click', function () { sound('tap'); opts.onClick(denom); });
    }
    return node;
  }

  // Řada nominálů s počtem (×N) — pro PŘEHLED/odpověď (např. správné řešení, zásuvka),
  // NE pro počítání. Kde se má počítat, použij pileRow (jednotlivé kusy).
  function breakdownRow(breakdown, opts) {
    opts = opts || {};
    const row = h('div', { class: 'denom-row' });
    breakdown.forEach(function (b) {
      row.appendChild(denomEl(b.denom, { size: opts.size || 'sm', count: b.count }));
    });
    if (!breakdown.length) row.appendChild(h('span', { class: 'muted' }, '—'));
    return row;
  }

  // Řada JEDNOTLIVÝCH kusů (BEZ multiplikátoru) — zákazníkova hrst, kterou je nutné spočítat.
  // Kusy se seskupí po nominálu a překryjí jako vějíř, ale tak, aby šly spočítat.
  function pileRow(breakdown, opts) {
    opts = opts || {};
    const row = h('div', { class: 'pile-stack' });
    breakdown.forEach(function (b) {
      const isCoin = META[b.denom].type === 'coin';
      const stack = h('div', { class: 'stack ' + (isCoin ? 'coins' : 'notes') });
      for (let i = 0; i < b.count; i++) {
        stack.appendChild(denomEl(b.denom, { size: opts.size || 'md' }));
      }
      row.appendChild(stack);
    });
    if (!breakdown.length) row.appendChild(h('span', { class: 'muted' }, '—'));
    return row;
  }

  /* ---- numerická klávesnice ---- */
  // onKey dostane: '0'..'9' | 'back' | 'enter'
  function numpad(onKey) {
    const pad = h('div', { class: 'numpad' });
    const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'back', '0', 'enter'];
    keys.forEach(function (k) {
      const label = k === 'back' ? icon('backspace') : k === 'enter' ? icon('check') : k;
      const extra = k === 'enter' ? ' key-enter' : k === 'back' ? ' key-back' : '';
      pad.appendChild(h('button', {
        class: 'key' + extra, type: 'button',
        onclick: function () { sound('tap'); onKey(k); }
      }, label));
    });
    return pad;
  }

  /* ---- velká zpětná vazba (✓ / ✗) ---- */
  function feedback(ok, msg, sub) {
    const root = document.getElementById('overlay');
    clear(root);
    sound(ok ? 'correct' : 'wrong');
    vibrate(ok ? 30 : [60, 40, 60]);
    const card = h('div', { class: 'fb ' + (ok ? 'fb-ok' : 'fb-no') },
      h('div', { class: 'fb-icon' }, icon(ok ? 'check_circle' : 'cancel')),
      h('div', { class: 'fb-msg' }, msg || (ok ? 'Správně!' : 'Chyba')),
      sub ? h('div', { class: 'fb-sub' }, sub) : null
    );
    root.appendChild(card);
    root.classList.add('show');
    setTimeout(function () { root.classList.remove('show'); }, ok ? 850 : 1700);
  }

  /* ---- malý toast ---- */
  function toast(msg) {
    const root = document.getElementById('toast');
    root.textContent = msg;
    root.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { root.classList.remove('show'); }, 1600);
  }

  /* ---- hlavička obrazovky s tlačítkem zpět ---- */
  function screenHeader(title, subtitle) {
    return h('div', { class: 'scr-head' },
      h('button', { class: 'back-btn', onclick: function () { BILLA.app.go('home'); } },
        icon('chevron_left', { size: 20 }), 'Zpět'),
      h('div', { class: 'scr-title' }, h('h2', null, title), subtitle ? h('p', null, subtitle) : null)
    );
  }

  // Přepínač obtížnosti (1–3). onChange(level)
  function difficultyPicker(onChange) {
    const cur = BILLA.store.settings.difficulty;
    const labels = { 1: 'Začátečník', 2: 'Pokročilý', 3: 'Profík' };
    const wrap = h('div', { class: 'diff-picker' });
    [1, 2, 3].forEach(function (lvl) {
      wrap.appendChild(h('button', {
        class: 'diff ' + (lvl === cur ? 'active' : ''),
        onclick: function () {
          BILLA.store.settings.difficulty = lvl; BILLA.store.save();
          wrap.querySelectorAll('.diff').forEach(function (b) { b.classList.remove('active'); });
          this.classList.add('active');
          if (onChange) onChange(lvl);
        }
      }, labels[lvl]));
    });
    return wrap;
  }

  BILLA.ui = {
    h, clear, icon, sound, vibrate, denomEl, breakdownRow, pileRow,
    numpad, feedback, toast, screenHeader, difficultyPicker
  };
})(window.BILLA = window.BILLA || {});
