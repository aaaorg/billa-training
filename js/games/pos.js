/* =========================================================================
   games/pos.js — Plná pokladna (kompletní průchod nákupem)
   Skenování zboží, váženky, BILLA Klub, zálohy, ověření věku, platba.
   ========================================================================= */
(function (BILLA) {
  'use strict';

  const ui = BILLA.ui, money = BILLA.money, h = ui.h, store = BILLA.store;
  const PRODUCTS = BILLA.data.PRODUCTS;
  const MODE = 'pos';
  const KLUB_CATS = ['Trvanlivé', 'Drogerie']; // kde Klub dává slevu 10 %
  const DEPOSIT = 4; // Kč záloha za vratný obal (orientačně)

  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

  /* ---- jednoduchý modal ---- */
  function modal(contentEl, opts) {
    opts = opts || {};
    const back = h('div', { class: 'modal-back' });
    const box = h('div', { class: 'modal' }, contentEl);
    back.appendChild(box);
    if (opts.dismissable !== false) {
      back.addEventListener('click', function (e) { if (e.target === back) close(); });
    }
    document.getElementById('overlay-stack').appendChild(back);
    requestAnimationFrame(function () { back.classList.add('show'); });
    function close() { back.classList.remove('show'); setTimeout(function () { back.remove(); }, 200); }
    return { close: close, box: box };
  }

  function render(root) {
    ui.clear(root);
    root.appendChild(ui.screenHeader('Plná pokladna', 'Naskenuj zboží a proveď platbu'));

    let cart = [];          // řádky účtenky
    let klub = false;
    let returnedDepositHaler = 0; // vykoupené zálohy (vratné obaly)
    let result = { age: null }; // sledování správnosti pro skóre
    let calc = {};          // průběžně přepočítané součty

    const wrap = h('div', { class: 'pos' });
    root.appendChild(wrap);

    // ----- levý sloupec: účtenka + souhrn -----
    const receipt = h('div', { class: 'receipt' });
    const totals = h('div', { class: 'totals' });
    const leftCol = h('div', { class: 'pos-left' },
      h('div', { class: 'receipt-head' }, h('span', null, '🧾 Účtenka'),
        h('button', { class: 'mini-btn', onclick: clearCart }, 'Nový nákup')),
      receipt, totals
    );

    // ----- pravý sloupec: zboží + akce -----
    const grid = h('div', { class: 'prod-grid' });
    buildGrid();
    const actions = h('div', { class: 'pos-actions' },
      h('button', { class: 'btn klub', id: 'klubBtn', onclick: toggleKlub }, '⭐ BILLA Klub'),
      h('button', { class: 'btn ghost', onclick: returnDeposit }, '♻️ Vrátit zálohu'),
      h('button', { class: 'btn primary pay', onclick: startPayment }, '💰 Zaplatit')
    );
    const rightCol = h('div', { class: 'pos-right' }, grid, actions);

    wrap.appendChild(rightCol);
    wrap.appendChild(leftCol);
    recompute();
    redraw();

    /* ---------- katalog ---------- */
    function buildGrid() {
      const cats = {};
      PRODUCTS.forEach(function (p) { (cats[p.cat] = cats[p.cat] || []).push(p); });
      Object.keys(cats).forEach(function (cat) {
        grid.appendChild(h('div', { class: 'cat-label' }, cat));
        const row = h('div', { class: 'cat-row' });
        cats[cat].forEach(function (p) {
          row.appendChild(h('button', {
            class: 'prod' + (p.age ? ' age' : '') + (p.deposit ? ' dep' : ''),
            onclick: function () { addProduct(p); }
          },
            h('span', { class: 'prod-emoji' }, p.emoji || '📦'),
            h('span', { class: 'prod-name' }, p.name),
            h('span', { class: 'prod-price' }, p.weighed
              ? money.formatKc(p.pricePerKg, { decimals: 2 }) + '/kg'
              : money.formatKc(p.price, { decimals: 2 })),
            p.age ? h('span', { class: 'badge-age' }, '18+') : null,
            p.deposit ? h('span', { class: 'badge-dep' }, '+zál.') : null
          ));
        });
        grid.appendChild(row);
      });
    }

    /* ---------- práce s košíkem ---------- */
    function addProduct(p) {
      ui.sound('tap');
      if (p.weighed) return weightModal(p);
      const ex = cart.find(function (l) { return l.product.id === p.id && !l.grams; });
      if (ex) ex.qty++;
      else cart.push({ product: p, qty: 1, grams: 0, haler: money.toHaler(p.price) });
      recompute(); redraw();
    }

    function weightModal(p) {
      let grams = '';
      const disp = h('div', { class: 'big-input' }, '0 g');
      const price = h('div', { class: 'weight-price' }, money.formatKc(0));
      function upd() {
        const g = parseInt(grams || '0', 10);
        disp.textContent = (grams || '0') + ' g  (' + (g / 1000).toFixed(3) + ' kg)';
        price.textContent = money.formatKc(Math.round(money.toHaler(p.pricePerKg) * g / 1000) / 100, { decimals: 2 });
      }
      const content = h('div', null,
        h('div', { class: 'modal-title' }, p.emoji + ' ' + p.name),
        h('div', { class: 'muted center' }, money.formatKc(p.pricePerKg, { decimals: 2 }) + ' / kg · zadej hmotnost (g)'),
        disp, price,
        ui.numpad(function (k) {
          if (k === 'back') grams = grams.slice(0, -1);
          else if (k === 'enter') return confirm();
          else if (grams.length < 5) grams = (grams === '0' ? '' : grams) + k;
          upd();
        })
      );
      const m = modal(content);
      function confirm() {
        const g = parseInt(grams || '0', 10);
        if (g <= 0) { m.close(); return; }
        const haler = Math.round(money.toHaler(p.pricePerKg) * g / 1000);
        cart.push({ product: p, qty: 1, grams: g, haler: haler });
        recompute(); redraw(); m.close();
      }
    }

    function removeLine(i) { ui.sound('tap'); cart.splice(i, 1); recompute(); redraw(); }
    function decLine(i) {
      const l = cart[i];
      if (l.grams || l.qty <= 1) return removeLine(i);
      l.qty--; recompute(); redraw();
    }
    function clearCart() {
      cart = []; klub = false; returnedDepositHaler = 0; result = { age: null };
      document.getElementById('klubBtn').classList.remove('on');
      recompute(); redraw();
    }
    function toggleKlub() {
      klub = !klub; ui.sound('tap');
      document.getElementById('klubBtn').classList.toggle('on', klub);
      recompute(); redraw();
    }
    function returnDeposit() {
      let n = '';
      const disp = h('div', { class: 'big-input' }, '0 ks');
      const val = h('div', { class: 'weight-price' }, money.formatKc(0));
      function upd() {
        const c = parseInt(n || '0', 10);
        disp.textContent = (n || '0') + ' ks';
        val.textContent = '− ' + money.formatKc(c * DEPOSIT);
      }
      const content = h('div', null,
        h('div', { class: 'modal-title' }, '♻️ Výkup vratných obalů'),
        h('div', { class: 'muted center' }, 'Záloha ' + money.formatKc(DEPOSIT) + ' / ks · zadej počet'),
        disp, val,
        ui.numpad(function (k) {
          if (k === 'back') n = n.slice(0, -1);
          else if (k === 'enter') { const c = parseInt(n || '0', 10); returnedDepositHaler = c * DEPOSIT * 100; recompute(); redraw(); m.close(); return; }
          else if (n.length < 3) n = (n === '0' ? '' : n) + k;
          upd();
        })
      );
      const m = modal(content);
    }

    /* ---------- výpočty ---------- */
    function recompute() {
      let items = 0, deposits = 0, klubBase = 0;
      cart.forEach(function (l) {
        items += l.haler;
        if (l.product.deposit) deposits += money.toHaler(l.product.deposit) * l.qty;
        if (klub && KLUB_CATS.indexOf(l.product.cat) !== -1) klubBase += l.haler;
      });
      const klubDisc = klub ? Math.round(klubBase * 0.10) : 0;
      const exact = items + deposits - klubDisc - returnedDepositHaler;
      calc = {
        items: items, deposits: deposits, klubDisc: klubDisc,
        returned: returnedDepositHaler,
        exact: exact, cash: money.roundCashHaler(exact)
      };
    }

    /* ---------- vykreslení ---------- */
    function redraw() {
      ui.clear(receipt);
      if (!cart.length) receipt.appendChild(h('div', { class: 'muted center pad' }, 'Klepej na zboží vpravo…'));
      cart.forEach(function (l, i) {
        const desc = l.grams
          ? (l.grams / 1000).toFixed(3) + ' kg × ' + money.formatKc(l.product.pricePerKg, { decimals: 2 }) + '/kg'
          : l.qty + ' ks × ' + money.formatKc(l.product.price, { decimals: 2 });
        receipt.appendChild(h('div', { class: 'rline' },
          h('div', { class: 'rline-main' },
            h('div', { class: 'rline-name' }, (l.product.emoji || '') + ' ' + l.product.name,
              l.product.age ? h('span', { class: 'mini-age' }, '18+') : null,
              l.product.deposit ? h('span', { class: 'mini-dep' }, '+zál. ' + money.formatKc(l.product.deposit) + '×' + l.qty) : null),
            h('div', { class: 'rline-desc' }, desc)
          ),
          h('div', { class: 'rline-tot' }, money.formatKc(l.haler / 100, { decimals: 2 })),
          h('div', { class: 'rline-btns' },
            h('button', { class: 'lbtn', onclick: function () { decLine(i); } }, '−'),
            h('button', { class: 'lbtn x', onclick: function () { removeLine(i); } }, '×'))
        ));
      });

      ui.clear(totals);
      function row(lab, val, cls) {
        return h('div', { class: 'trow ' + (cls || '') }, h('span', null, lab), h('span', null, val));
      }
      totals.appendChild(row('Mezisoučet', money.formatKc(calc.items / 100, { decimals: 2 })));
      if (calc.deposits) totals.appendChild(row('Zálohy (vratné obaly)', '+ ' + money.formatKc(calc.deposits / 100, { decimals: 2 })));
      if (calc.klubDisc) totals.appendChild(row('Sleva BILLA Klub', '− ' + money.formatKc(calc.klubDisc / 100, { decimals: 2 }), 'disc'));
      if (calc.returned) totals.appendChild(row('Výkup obalů', '− ' + money.formatKc(calc.returned / 100, { decimals: 2 }), 'disc'));
      totals.appendChild(row('Celkem', money.formatKc(calc.exact / 100, { decimals: 2 }), 'grand'));
      if (calc.cash !== calc.exact) totals.appendChild(row('Hotově (zaokr.)', money.formatKc(calc.cash / 100), 'cashrow'));
    }

    /* ---------- platba ---------- */
    function startPayment() {
      if (!cart.length) { ui.toast('Košík je prázdný'); return; }
      // nejdřív věk, pokud je v košíku 18+ zboží
      const hasAge = cart.some(function (l) { return l.product.age; });
      if (hasAge && result.age == null) return ageModal(choosePayment);
      choosePayment();
    }

    function ageModal(then) {
      // ~30 % zákazník vypadá mladě → správně je NEPRODAT
      const looksYoung = Math.random() < 0.3;
      const content = h('div', null,
        h('div', { class: 'modal-title' }, '🔞 Kontrola věku'),
        h('div', { class: 'age-face' }, looksYoung ? '🧑' : '🧔'),
        h('div', { class: 'center' }, 'Nákup obsahuje alkohol/tabák. Zákazník '
          + (looksYoung ? 'vypadá velmi mladě a NEMÁ u sebe doklad.' : 'předložil doklad, je mu prokazatelně 18+.')),
        h('div', { class: 'age-btns' },
          h('button', { class: 'btn good-btn', onclick: function () { decide(true); } }, 'Prodat'),
          h('button', { class: 'btn bad-btn', onclick: function () { decide(false); } }, 'Odmítnout prodej')
        )
      );
      const m = modal(content, { dismissable: false });
      function decide(sell) {
        const correct = looksYoung ? !sell : sell;
        result.age = correct;
        m.close();
        if (looksYoung && sell) {
          // chyba — prodej nezletilému
          ui.feedback(false, 'Nesmíš prodat!', 'Bez dokladu a při pochybnostech alkohol/tabák NEPRODÁVÁŠ.');
          store.record(MODE, false, 0);
          setTimeout(clearCart, 1700);
          return;
        }
        if (looksYoung && !sell) {
          ui.feedback(true, 'Správně odmítnuto', 'Bez dokladu nelze prodat. Nákup ruším.');
          setTimeout(clearCart, 1500);
          return;
        }
        // má doklad → pokračuj v platbě
        then();
      }
    }

    function choosePayment() {
      const content = h('div', null,
        h('div', { class: 'modal-title' }, 'Platba ' + money.formatKc(calc.exact / 100, { decimals: 2 })),
        h('div', { class: 'pay-choice' },
          h('button', { class: 'btn pay-cash', onclick: function () { m.close(); payCash(); } },
            '💵 Hotově', h('small', null, money.formatKc(calc.cash / 100) + ' (zaokr.)')),
          h('button', { class: 'btn pay-card', onclick: function () { m.close(); payCard(); } },
            '💳 Kartou', h('small', null, money.formatKc(calc.exact / 100, { decimals: 2 }) + ' (přesně)'))
        )
      );
      const m = modal(content);
    }

    /* --- hotovost: zadej přijatou hotovost → pokladna ukáže kolik vrátit → odpočítej --- */
    function payCash() {
      const cashTotal = calc.cash / 100;
      let typed = '';
      const disp = h('div', { class: 'big-input' }, '0 Kč');
      const content = h('div', null,
        h('div', { class: 'register' }, h('div', { class: 'reg-screen' },
          h('div', { class: 'reg-row' }, h('span', null, 'K ÚHRADĚ'), h('span', { class: 'reg-due' }, money.formatKc(cashTotal))))),
        h('div', { class: 'muted center' }, 'Spočítej a zadej přijatou hotovost:'),
        disp,
        ui.numpad(function (k) {
          if (k === 'back') typed = typed.slice(0, -1);
          else if (k === 'enter') return takeTender();
          else if (typed.length < 6) typed = (typed === '0' ? '' : typed) + k;
          disp.textContent = (typed || '0') + ' Kč';
        })
      );
      const m = modal(content, { dismissable: false });
      function takeTender() {
        const tendered = parseInt(typed || '0', 10);
        if (tendered < cashTotal) { ui.toast('Málo — méně než ' + money.formatKc(cashTotal)); return; }
        m.close();
        if (tendered === cashTotal) { finishTx(true, 0, tendered, cashTotal, 'hotově'); return; }
        assembleChange(tendered, cashTotal);
      }
    }

    // pokladna spočítá změnu a ukáže ji; pokladní ji odpočítá z drobných
    function assembleChange(tendered, cashTotal) {
      const change = tendered - cashTotal;
      let built = [];
      const builtBox = h('div', { class: 'built' });
      const sumLine = h('div', { class: 'built-sum' });
      function sum() { return built.reduce(function (s, d) { return s + d; }, 0); }
      function redraw() {
        ui.clear(builtBox);
        if (!built.length) builtBox.appendChild(h('span', { class: 'muted' }, 'Klepej na mince a bankovky…'));
        built.forEach(function (d, i) { builtBox.appendChild(ui.denomEl(d, { size: 'sm', clickable: true, onClick: function () { built.splice(i, 1); redraw(); } })); });
        const s = sum();
        sumLine.textContent = 'Odpočítáno: ' + money.formatKc(s) + (s !== change ? (s < change ? '  (chybí ' + money.formatKc(change - s) + ')' : '  (přebývá ' + money.formatKc(s - change) + ')') : '');
        sumLine.className = 'built-sum' + (s === change ? ' ok' : s > change ? ' over' : '');
      }
      const palette = h('div', { class: 'palette' });
      money.DENOMS.slice().reverse().forEach(function (d) {
        if (d > change) return;
        palette.appendChild(ui.denomEl(d, { size: 'md', clickable: true, onClick: function () { ui.sound('coin'); built.push(d); redraw(); } }));
      });
      const content = h('div', null,
        h('div', { class: 'register' }, h('div', { class: 'reg-screen' },
          h('div', { class: 'reg-row change' }, h('span', null, 'VRÁTIT'), h('span', { class: 'reg-change' }, money.formatKc(change))))),
        h('div', { class: 'muted center' }, 'Zákazník dal ' + money.formatKc(tendered) + ' · odpočítej drobné nazpět:'),
        builtBox, sumLine, palette,
        h('button', { class: 'btn primary big', onclick: function () {
          if (sum() !== change) { ui.toast('Musí sedět přesně ' + money.formatKc(change)); return; }
          m.close(); finishTx(true, change, tendered, cashTotal, 'hotově');
        } }, 'Vrátit zákazníkovi')
      );
      const m = modal(content, { dismissable: false });
      redraw();
    }

    /* --- karta: terminál, občas zamítnutí --- */
    function payCard() {
      const status = h('div', { class: 'term-status' }, 'Přiložte / vložte kartu…');
      const content = h('div', null,
        h('div', { class: 'modal-title' }, '💳 Platební terminál'),
        h('div', { class: 'terminal' }, h('div', { class: 'term-amt' }, money.formatKc(calc.exact / 100, { decimals: 2 })), status)
      );
      const m = modal(content, { dismissable: false });
      ui.sound('tap');
      setTimeout(function () { status.textContent = 'Zpracovávám…'; }, 800);
      setTimeout(function () {
        const declined = Math.random() < 0.12;
        if (declined) {
          status.textContent = '✗ ZAMÍTNUTO';
          status.classList.add('declined');
          const acts = h('div', { class: 'age-btns' },
            h('button', { class: 'btn ghost', onclick: function () { m.close(); payCard(); } }, 'Zkusit znovu'),
            h('button', { class: 'btn primary', onclick: function () { m.close(); payCash(); } }, 'Platit hotově'));
          m.box.appendChild(acts);
        } else {
          status.textContent = '✓ SCHVÁLENO';
          status.classList.add('approved');
          ui.sound('cash');
          setTimeout(function () { m.close(); finishTx(true, 0, null, null, 'kartou'); }, 900);
        }
      }, 1800);
    }

    /* --- konec transakce --- */
    function finishTx(changeOK, change, tendered, cashTotal, how) {
      let pts = 10;
      if (result.age === false) pts = 0;
      if (how === 'hotově') pts += changeOK ? 10 : 0;
      const ok = changeOK && result.age !== false;
      store.record(MODE, ok, ok ? pts : 0);

      const content = h('div', null,
        h('div', { class: 'modal-title' }, ok ? '🎉 Hotovo' : '⚠️ Dokončeno s chybou'),
        h('div', { class: 'sum-receipt' },
          h('div', { class: 'trow grand' }, h('span', null, 'Zaplaceno ' + how), h('span', null,
            money.formatKc((how === 'hotově' ? cashTotal : calc.exact / 100), { decimals: how === 'hotově' ? 0 : 2 }))),
          how === 'hotově' ? h('div', { class: 'trow' }, h('span', null, 'Vráceno'), h('span', null, money.formatKc(change))) : null,
          how === 'hotově' && change > 0 ? ui.pileRow(money.makeChange(change), { size: 'sm' }) : null,
          h('div', { class: 'trow' }, h('span', null, 'Body za nákup'), h('span', null, '+' + (ok ? pts : 0)))
        ),
        h('button', { class: 'btn primary big', onclick: function () { m.close(); clearCart(); } }, 'Nový nákup →')
      );
      const m = modal(content, { dismissable: false });
      if (ok) { ui.sound('cash'); ui.vibrate(40); }
    }
  }

  BILLA.games = BILLA.games || {};
  BILLA.games.pos = { title: 'Plná pokladna', render: render };
})(window.BILLA = window.BILLA || {});
