// Token Radar, radar-4 dashboard. It reads window.RADAR (written beside dashboard/ by main.ts)
// and renders the ranked board, a filterable table, a per-protocol detail drawer with the model's
// own breakdown and the protocol's farm plan. No network: every byte it shows is in data.js.
//
// The page recomputes each row from the snapshot figures with impliedOf, the same arithmetic
// lib/model.ts runs, and checks the number board.json carries, so the page's code and the board's
// data are visibly the same model. Farm steps are board.json's own steps, shown as written.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  // A row is on the watchlist when its TVL clears the floor: above the floor the watchlist is
  // authoritative, and every above-floor row on this board is a watchlist slug.
  var state = { q: '', category: 'all', chain: 'all', verdict: 'all', watchOnly: false, posGrowth: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return (n === null || n === undefined || !isFinite(n)) ? 'n/a' : 'x' + n.toFixed(2); }

  // radar-4 in one function: the comps model fitted at run time on the live-token protocols.
  // log(implied) = intercept + slope x log(TVL) + category effect + growth term + age term,
  // each term's contribution clamped to +/-0.3 log points; the coefficients and the category
  // effects come from data.js, where the program wrote the fit, so this page and lib/model.ts
  // can never disagree about them.
  function impliedOf(row, model) {
    var growthAdj = Math.max(-0.3, Math.min(0.3, model.ga.growth * (Math.max(-50, Math.min(150, row.growth_pct)) / 100)));
    var ageDays = row.age_days === null || row.age_days === undefined ? model.curve.median_age_days : row.age_days;
    var ageAdj = Math.max(-0.3, Math.min(0.3, model.ga.age * Math.log1p(ageDays)));
    var logImplied = model.curve.intercept + model.curve.slope * row.log_tvl
      + (model.eb[row.category || 'Other'] || 0) + growthAdj + ageAdj;
    return Math.max(1, Math.round(Math.exp(logImplied)));
  }
  // The four fitted factors of one row, as multipliers, for the detail drawer.
  function factorsOf(row, model) {
    var curveVal = Math.exp(model.curve.intercept + model.curve.slope * row.log_tvl);
    var catEffect = model.eb[row.category || 'Other'] || 0;
    var growthAdj = Math.max(-0.3, Math.min(0.3, model.ga.growth * (Math.max(-50, Math.min(150, row.growth_pct)) / 100)));
    var ageDays = row.age_days === null || row.age_days === undefined ? model.curve.median_age_days : row.age_days;
    var ageAdj = Math.max(-0.3, Math.min(0.3, model.ga.age * Math.log1p(ageDays)));
    return { curveVal: curveVal, catEffect: catEffect, growthAdj: growthAdj, ageAdj: ageAdj };
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function isWatchlist(r) { return r.tvl_usd >= DATA.floor_usd; }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('verdict')) state.verdict = params.get('verdict');
    if (params.get('watch') === '1') state.watchOnly = true;
    if (params.get('growth') === '1') state.posGrowth = true;
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.verdict !== 'all') params.set('verdict', state.verdict);
    if (state.watchOnly) params.set('watch', '1');
    if (state.posGrowth) params.set('growth', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.verdict !== 'all' && r.verdict !== state.verdict) return false;
      if (state.watchOnly && !isWatchlist(r)) return false;
      if (state.posGrowth && !(r.change_7d !== null && r.change_7d > 0)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.multiple; bv = b.multiple; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', null, 'Snapshot ', el('b', { text: DATA.as_of })),
        el('span', null, 'Model ', el('b', { text: DATA.model_version })),
        el('span', null, 'Rows ', el('b', { text: String(DATA.board_size) }))
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Which pre-token protocol is worth farming next?' }),
        el('p', null,
          'The watchlist is the floor: ', el('b', { text: DATA.watchlist_size + ' protocols' }),
          ' with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The early radar adds ',
          el('b', { text: DATA.early_size + ' more below that floor' }),
          ', ranked by an implied value a comps model fits on the ', el('b', { text: DATA.model.curve.n_comps + ' live-token protocols' }),
          ' in this same snapshot. Implied value is a model, not a promise — and never a claim that a token exists.'
        )
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Comps the model is fitted on' }), el('b', { text: String(DATA.model.curve.n_comps) })),
        el('div', { class: 'fact' }, el('span', { text: 'Out-of-sample error cut vs flat multiple' }), el('b', { text: DATA.model.validation.lift_pct.toFixed(0) + '%' })),
        el('div', { class: 'fact' }, el('span', { text: 'Farm verdicts' }), el('b', { text: 'FARM ' + DATA.model.verdict_counts.farm + ' · THIN ' + DATA.model.verdict_counts.thin + ' · SKIP ' + DATA.model.verdict_counts.skip }))
      )
    );
  }

  function spotlight() {
    var top = DATA.rows.slice(0, 3);
    return el('section', { class: 'spot', 'aria-label': 'Top three by implied value' },
      top.map(function (r) {
        return el('button', { type: 'button', class: 'spot-card', onclick: function () { openDetail(r.slug); } },
          el('span', { class: 'rank', text: 'Rank ' + r.rank }),
          el('b', { text: r.name }),
          el('span', { class: 'val', text: fmtUsd(r.implied_value_usd) + ' implied' }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · TVL ' + fmtUsd(r.tvl_usd) + ' · ' + fmtPct(r.change_7d) + ' in 7d · ' + r.verdict.toUpperCase() })
        );
      })
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSel = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSel.addEventListener('change', function () { state.category = catSel.value; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var verdictSel = el('select', { id: 'verdict', 'aria-label': 'Filter by farm verdict' },
      el('option', { value: 'all', text: 'All verdicts' }),
      ['farm', 'thin', 'skip'].map(function (v) { return el('option', { value: v, text: v.toUpperCase(), selected: v === state.verdict ? 'selected' : null }); })
    );
    verdictSel.addEventListener('change', function () { state.verdict = verdictSel.value; writeHash(); render(); });
    var watchBox = el('input', { type: 'checkbox', id: 'watch', checked: state.watchOnly ? 'checked' : null, 'aria-label': 'Watchlist only' });
    watchBox.addEventListener('change', function () { state.watchOnly = watchBox.checked; writeHash(); render(); });
    var growthBox = el('input', { type: 'checkbox', id: 'growth', checked: state.posGrowth ? 'checked' : null, 'aria-label': 'Growing only' });
    growthBox.addEventListener('change', function () { state.posGrowth = growthBox.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSel),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('label', { for: 'verdict', text: 'Farm verdict' }), verdictSel),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Filters' }),
        el('div', { class: 'checks' },
          el('label', null, watchBox, 'Watchlist only'),
          el('label', null, growthBox, 'Growing only')
        )),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchOnly = false; state.posGrowth = false; writeHash(); render(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var nameCell = el('div', { class: 'name' },
        el('b', null, r.name, isWatchlist(r) ? el('span', { class: 'watch', text: 'Watchlist' }) : null),
        el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
      );
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, nameCell),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: fmtMult(r.multiple) }),
        el('td', null, el('span', { class: 'verdict ' + r.verdict, text: r.verdict.toUpperCase() })),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Multiple'),
            el('th', { scope: 'col', text: 'Farm verdict' }),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking — and their market caps are the comps the curve is fitted on.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var c = m.curve;
    var v = m.validation;
    var quartNames = ['Smallest TVL quartile', 'Second TVL quartile', 'Third TVL quartile', 'Largest TVL quartile'];
    var ebEntries = Object.keys(m.eb).map(function (k) { return { category: k, effect: m.eb[k] }; })
      .sort(function (a, b) { return Math.abs(b.effect) - Math.abs(a.effect); }).slice(0, 12);
    return el('section', { class: 'panel model' },
      el('h2', null, 'How implied value is fitted ', el('span', { class: 'tag', text: 'MODEL ' + DATA.model_version })),
      el('p', { class: 'sub', text: 'Three fitted parts, all of them fitted on this snapshot alone by least squares over the ' + c.n_comps + ' live-token protocols that record a market cap and a TVL. No protocol name is special-cased, and no pre-token protocol enters the fit: the model is blind to the board it ranks.' }),
      el('div', { class: 'formula' },
        'log(implied value) = ' + c.intercept.toFixed(3) + ' + ' + c.slope.toFixed(3) + ' x log(tvl_usd)' +
        ' + category effect + ' + m.ga.growth.toFixed(3) + ' x growth + ' + m.ga.age.toFixed(3) + ' x log1p(age days)' +
        '   —   each term capped at +/-0.30 log points'
      ),
      el('p', { class: 'sub', text: 'Value grows with the square root of TVL, not with TVL itself: the fitted slope is about ' + c.slope.toFixed(2) + ', so the multiple a protocol earns falls as it gets bigger. The median market-cap / TVL ratio of the live comps is ' + fmtMult(m.ratio_quartiles[0]) + ' in the smallest TVL quartile and ' + fmtMult(m.ratio_quartiles[3]) + ' in the largest — an 18-fold fall. A flat multiple pays the giants far too much; the curve charges each size what its own comps imply. The category effect is each category\u2019s mean residual from the curve, shrunk toward zero by n / (n + 20) and capped at +/-0.50 log points, so a category with two comps barely moves a value and one with fifteen moves it more. Growth and age carry their fitted weights too: a seven-day surge is usually a small protocol rebounding, so the fit gives growth a small negative weight, and age with no token carries almost none — the fit decides how much each input counts, and every one of the three named inputs is in the model.' }),
      el('div', { class: 'mult-grid' }, m.ratio_quartiles.map(function (q, i) {
        return el('div', { class: 'mult' }, el('span', { text: quartNames[i] }), el('b', { text: fmtMult(q) }));
      })),
      el('h3', { text: 'Category effects, strongest first' }),
      el('div', { class: 'mult-grid' }, ebEntries.map(function (e) {
        return el('div', { class: 'mult' }, el('span', { text: e.category }), el('b', { text: 'x' + Math.exp(e.effect).toFixed(2) }));
      })),
      el('h3', { text: 'Tested out of sample, before it was trusted' }),
      el('p', { class: 'sub', text: 'Five-fold cross-validation, the folds fixed by a hash of each protocol\u2019s slug, scored on log market cap. The baseline is the flat category-median multiple — the previous model\u2019s approach — which scores below zero out of sample, worse than the mean. Against that baseline the fitted family cuts out-of-sample squared error by about a fifth: the complete model by ' + v.lift_pct.toFixed(0) + '%. Comps are noisy: a live token\u2019s multiple spans 0.006 to 5.1, a thousand-fold, so the model ranks by the central tendency — it does not promise a point value for any single launch.' }),
      el('div', { class: 'mult-grid' },
        el('div', { class: 'mult' }, el('span', { text: 'Out-of-sample error cut' }), el('b', { text: v.lift_pct.toFixed(0) + '%' })),
        el('div', { class: 'mult' }, el('span', { text: 'Cross-validated R²' }), el('b', { text: v.cv_r2.toFixed(2) }))
      ),
      el('h3', { text: 'What the rivals scored, fitted and validated the same way' }),
      el('div', { class: 'breakdown' }, m.ablation.map(function (a) {
        return el('div', { class: 'row' }, el('span', { text: a.label }), el('b', { text: 'error cut ' + a.lift_pct.toFixed(0) + '%' }));
      })),
      el('p', { class: 'sub', text: 'The complete model trades a point of the curve\u2019s lift for a model that uses every input the brief names — TVL, seven-day growth and time with no token — plus a category effect. Every fitted spec beats the flat multiple by about a fifth out of sample; the flat multiple is the baseline at 0%.' }),
      el('h3', { text: 'Rank is the launch\u2019s value. The verdict is whether farming it pays.' }),
      el('p', { class: 'sub', text: 'Each row carries a farm verdict — FARM, THIN or SKIP — set by its multiple (implied value over TVL, the value each locked dollar creates at launch) against the board\u2019s own tertiles: the top third of multiples is FARM (' + m.verdict_counts.farm + ' rows), the middle third THIN (' + m.verdict_counts.thin + '), the bottom third SKIP (' + m.verdict_counts.skip + '). Giants rank high but farm thin or not at all: the launch is worth the most, but at billions of TVL a farm position buys almost no share of it, so the plan spends little or nothing. Small, high-multiple launches are the farms: the same dollars buy far more of the launch.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row, DATA.model);
    var factors = factorsOf(row, DATA.model);
    var steps = row.farm_steps || [];
    var verdictText = row.verdict === 'farm'
      ? 'FARM — this launch\u2019s multiple is in the top third of the board, so a full position is worth it.'
      : row.verdict === 'thin'
        ? 'THIN — this launch\u2019s multiple is in the middle third, so farm it lightly and skip the big deposit.'
        : 'SKIP — this launch\u2019s multiple is in the bottom third, so do not deposit; farm only the free actions.';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (isWatchlist(row) ? ' · Watchlist' : ' · Early') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value — the model, factor by factor' }),
      el('div', { class: 'breakdown' },
        el('div', { class: 'row' }, el('span', { text: 'TVL' }), el('b', { text: fmtUsd(row.tvl_usd) })),
        el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:100%' })),
        el('div', { class: 'row' }, el('span', { text: 'log(TVL)' }), el('b', { text: row.log_tvl.toFixed(2) })),
        el('div', { class: 'row' }, el('span', { text: 'Size curve' }), el('b', { text: fmtUsd(factors.curveVal) })),
        el('div', { class: 'row' }, el('span', { text: 'Category effect (' + (row.category || 'Other') + ')' }), el('b', { text: 'x' + Math.exp(factors.catEffect).toFixed(2) + (factors.catEffect === 0 ? ' (no effect: fewer than two comps)' : '') })),
        el('div', { class: 'row' }, el('span', { text: 'Seven-day growth (' + fmtPct(row.change_7d) + ')' }), el('b', { text: 'x' + Math.exp(factors.growthAdj).toFixed(2) })),
        el('div', { class: 'row' }, el('span', { text: 'Age with no token (' + fmtAge(row.age_days) + ')' }), el('b', { text: 'x' + Math.exp(factors.ageAdj).toFixed(2) })),
        el('div', { class: 'row' }, el('span', { text: 'Multiple at this size' }), el('b', { text: fmtMult(row.multiple) })),
        el('div', { class: 'row' }, el('span', { text: 'Implied value' }), el('b', { text: fmtUsd(row.implied_value_usd) })),
        el('div', { class: 'row' }, el('span', { text: 'Farm verdict' }), el('b', { text: row.verdict.toUpperCase() }))
      ),
      el('p', { class: 'sub', text: verdictText + ' Rank is the launch\u2019s value; the verdict is whether farming it pays — the multiple is the value each locked dollar creates at launch, so giants rank high but farm thin while small, high-multiple launches are the farms.' }),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price, and "records no token" means the snapshot carries none — the protocol may still have one its record does not show.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan — 8 steps' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    dialog.appendChild(el('div', { class: 'note' },
      el('b', { text: 'Stay safe: ' }),
      'farm only with money you can lose, verify every contract address on the protocol\u2019s own page, and never pay a fee to claim — a claim that asks for payment is a scam.'
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(spotlight());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
