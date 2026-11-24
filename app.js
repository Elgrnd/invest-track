(() => {
  const STORAGE_KEY = 'invest-track:v1';
  const TABS = { crypto: 'Crypto', bourse: 'Bourse', total: 'Total' };
  const LIVE_KEY = STORAGE_KEY + ':live';
  const LIVE_MAX_AGE = 5 * 60 * 1000; // cours en direct rafraîchis au plus toutes les 5 minutes
  const OTHER = '__other__';
  const EOD_KEY = STORAGE_KEY + ':eodhd-key';      // clé API, jamais exportée
  const EOD_LIVE = STORAGE_KEY + ':live-bourse';   // derniers cours de clôture récupérés
  const EOD_MAX_AGE = 6 * 60 * 60 * 1000;          // 1 appel par ETF toutes les 6 h au plus (offre gratuite : 20/jour)
  const TICKER_RE = /^[A-Z0-9][A-Z0-9\-_]*\.[A-Z]{1,6}$/;
  const CATALOG = window.CATALOG || { crypto: [], bourse: [] };
  // Couleurs des graphiques : palette catégorielle validée (daltonisme) sur fond sombre.
  const PALETTE = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
  const OTHER_COLOR = '#64748b';
  const KIND_COLORS = { crypto: '#c98500', bourse: '#3987e5' };

  const $ = (id) => document.getElementById(id);
  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const euroRound = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const euroCompact = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });
  const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
  const monthShortFmt = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });
  const pctFmt = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0 });
  const pnlPctFmt = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 1, signDisplay: 'exceptZero' });
  const qtyFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 8 });
  const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const dayFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const priceFmt = (v) => new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    maximumSignificantDigits: v >= 1000 ? undefined : 6,
    maximumFractionDigits: v >= 1000 ? 2 : undefined,
  }).format(v);
  const signedEuro = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + euro.format(Math.abs(v));

  // ---------- Données ----------
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && Array.isArray(data.crypto) && Array.isArray(data.bourse)) {
        data.prices = { crypto: {}, bourse: {}, ...(data.prices || {}) };
        data.tickers = { bourse: {}, ...(data.tickers || {}) };
        return data;
      }
    } catch (e) { /* données absentes ou illisibles */ }
    return { crypto: [], bourse: [], prices: { crypto: {}, bourse: {} }, tickers: { bourse: {} } };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { alert("Impossible d'enregistrer les données sur cet appareil."); }
  }

  let state = load();
  let tab = (() => { const t = localStorage.getItem(STORAGE_KEY + ':tab'); return t in TABS ? t : 'crypto'; })();
  let editingId = null;
  let focusKey = null; // part du camembert mise en avant

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const ymOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const currentMonth = () => ymOf(new Date());
  const toDate = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1); };
  const monthLabel = (ym) => monthFmt.format(toDate(ym));
  const monthShort = (ym) => monthShortFmt.format(toDate(ym)).replace('.', '');
  const nextMonth = (ym) => { const d = toDate(ym); d.setMonth(d.getMonth() + 1); return ymOf(d); };
  const monthRange = (from, to) => { const out = []; for (let m = from; m <= to; m = nextMonth(m)) out.push(m); return out; };
  const sum = (list) => list.reduce((s, e) => s + e.amount, 0);
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** Lignes visibles dans l'onglet courant (l'onglet Total regroupe tout). */
  function entriesFor(t) {
    if (t === 'total') return [
      ...state.crypto.map((e) => ({ ...e, kind: 'crypto' })),
      ...state.bourse.map((e) => ({ ...e, kind: 'bourse' })),
    ];
    return state[t].map((e) => ({ ...e, kind: t }));
  }

  /**
   * Couleur stable par actif : attribuée dans l'ordre de première apparition,
   * jamais selon le classement (ajouter un montant ne repeint pas les autres).
   * Au-delà de 8 actifs, les suivants sont regroupés dans « Autres ».
   */
  function assetColors(entries) {
    const order = [];
    [...entries].sort((a, b) => a.month.localeCompare(b.month)).forEach((e) => {
      if (!order.includes(e.asset)) order.push(e.asset);
    });
    const keep = order.length > PALETTE.length ? PALETTE.length - 1 : PALETTE.length;
    const map = {};
    order.forEach((a, i) => { map[a] = i < keep ? { key: a, color: PALETTE[i] } : { key: 'Autres', color: OTHER_COLOR }; });
    return map;
  }

  /** Parts du camembert pour l'onglet courant. */
  function slicesFor(entries) {
    if (tab === 'total') {
      return ['crypto', 'bourse']
        .map((k) => ({ key: TABS[k], color: KIND_COLORS[k], value: sum(entries.filter((e) => e.kind === k)) }))
        .filter((s) => s.value > 0);
    }
    const colors = assetColors(entries);
    const groups = {};
    entries.forEach((e) => {
      const { key, color } = colors[e.asset];
      (groups[key] ||= { key, color, value: 0 }).value += e.amount;
    });
    // Ordre d'affichage : du plus gros au plus petit, « Autres » en dernier.
    return Object.values(groups).sort((a, b) =>
      (a.key === 'Autres') - (b.key === 'Autres') || b.value - a.value);
  }

  // ---------- Rendu ----------
  function render() {
    const entries = entriesFor(tab);
    const total = sum(entries);
    document.body.className = tab;
    $('title').textContent = TABS[tab];
    document.querySelectorAll('.tabs button').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.tab === tab)));

    // Total, année en cours, moyenne mensuelle
    $('total').textContent = euro.format(total);
    const year = String(new Date().getFullYear());
    $('yearLabel').textContent = `En ${year}`;
    $('yearTotal').textContent = euroRound.format(sum(entries.filter((e) => e.month.startsWith(year))));
    const months = entries.map((e) => e.month).sort();
    const span = months.length
      ? monthRange(months[0], months[months.length - 1] > currentMonth() ? months[months.length - 1] : currentMonth()).length
      : 0;
    $('avg').textContent = euroRound.format(span ? total / span : 0);

    // Formulaire (pas de saisie dans l'onglet Total)
    $('formCard').hidden = tab === 'total';
    if (tab !== 'total') {
      renderAssetSelect();
      renderFormMode();
      renderRepeat();
    }

    $('splitTitle').textContent = tab === 'total' ? 'Crypto / Bourse' : 'Répartition par actif';
    renderDonut(slicesFor(entries), total);
    renderChart(entries);
    renderValue();
    renderEodSettings();
    renderHistory(entries);
  }

  function renderFormMode() {
    const editing = editingId !== null;
    $('formCard').classList.toggle('editing', editing);
    $('formTitle').textContent = editing ? "Modifier l'investissement" : 'Nouvel investissement';
    $('submitBtn').textContent = editing ? 'Enregistrer' : 'Ajouter';
    $('cancelBtn').hidden = !editing;
  }

  // ----- Répéter le mois précédent -----
  function repeatSource() {
    const target = $('month').value;
    if (!target || tab === 'total' || editingId) return null;
    const list = state[tab];
    if (list.some((e) => e.month === target)) return null; // mois déjà rempli
    const prev = list.map((e) => e.month).filter((m) => m < target).sort().pop();
    return prev ? { from: prev, to: target, items: list.filter((e) => e.month === prev) } : null;
  }
  function renderRepeat() {
    const src = repeatSource();
    const btn = $('repeatBtn');
    btn.hidden = !src;
    if (!src) return;
    const names = src.items.map((e) => e.asset).join(', ');
    btn.innerHTML = `↻ Répéter <b>${escapeHtml(monthLabel(src.from))}</b> en <b>${escapeHtml(monthLabel(src.to))}</b><br>` +
      `<small>${escapeHtml(names)} · ${euro.format(sum(src.items))}</small>`;
  }

  // ----- Camembert (anneau) -----
  function renderDonut(slices, total) {
    const svg = $('donut');
    $('splitCard').hidden = slices.length === 0;
    if (!slices.length) { svg.innerHTML = ''; return; }
    if (!slices.some((s) => s.key === focusKey)) focusKey = null;

    const r = 62, C = 2 * Math.PI * r, gap = slices.length > 1 ? 2 : 0;
    let offset = 0;
    svg.innerHTML = slices.map((s) => {
      const len = (s.value / total) * C;
      const seg = `<circle class="seg${s.key === focusKey ? ' focus' : ''}" data-key="${escapeHtml(s.key)}"
        cx="80" cy="80" r="${r}" fill="none" stroke="${s.color}" stroke-width="22"
        stroke-dasharray="${Math.max(len - gap, 0.5)} ${C}" stroke-dashoffset="${-offset}"></circle>`;
      offset += len;
      return seg;
    }).join('');
    svg.classList.toggle('has-focus', focusKey !== null);

    const f = slices.find((s) => s.key === focusKey);
    $('donutCenter').innerHTML = f
      ? `<span>${escapeHtml(f.key)}</span><b>${euroRound.format(f.value)}</b><small>${pctFmt.format(f.value / total)}</small>`
      : `<span>Total</span><b>${euroRound.format(total)}</b>`;

    $('legend').innerHTML = slices.map((s) => `
      <li data-key="${escapeHtml(s.key)}" class="${s.key === focusKey ? 'focus' : ''}">
        <span class="sw" style="background:${s.color}"></span>
        <span class="name">${escapeHtml(s.key)}</span>
        <span class="pct">${pctFmt.format(s.value / total)}</span>
        <b>${euro.format(s.value)}</b>
      </li>`).join('');
  }

  function toggleFocus(key) {
    focusKey = focusKey === key ? null : key;
    const entries = entriesFor(tab);
    renderDonut(slicesFor(entries), sum(entries));
  }
  $('donut').addEventListener('click', (ev) => {
    const seg = ev.target.closest('.seg');
    if (seg) toggleFocus(seg.dataset.key);
  });
  $('legend').addEventListener('click', (ev) => {
    const li = ev.target.closest('li');
    if (li) toggleFocus(li.dataset.key);
  });

  // ----- Graphique d'évolution (total cumulé) -----
  let chartData = null;
  function renderChart(entries) {
    const box = $('chart');
    $('chartCard').hidden = entries.length === 0;
    if (!entries.length) { box.innerHTML = ''; chartData = null; return; }

    const months = entries.map((e) => e.month).sort();
    const last = months[months.length - 1] > currentMonth() ? months[months.length - 1] : currentMonth();
    let range = monthRange(months[0], last);
    if (range.length === 1) range = [ymOf(new Date(toDate(range[0]).setMonth(toDate(range[0]).getMonth() - 1))), ...range];

    let cum = 0;
    const points = range.map((m) => {
      const inMonth = entries.filter((e) => e.month === m);
      const added = sum(inMonth);
      cum += added;
      return {
        m, added, cum,
        crypto: sum(inMonth.filter((e) => e.kind === 'crypto')),
        bourse: sum(inMonth.filter((e) => e.kind === 'bourse')),
      };
    });

    const W = Math.max(box.clientWidth, 240), H = 190;
    const pad = { l: 46, r: 10, t: 10, b: 24 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const maxY = niceMax(cum);
    const x = (i) => pad.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
    const y = (v) => pad.t + ih - (v / maxY) * ih;

    const ticks = [0, maxY / 3, (2 * maxY) / 3, maxY];
    const grid = ticks.map((t) => `
      <line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"></line>
      <text class="axis" x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end">${euroCompact.format(t)}</text>`).join('');

    // Étiquettes de mois : au plus ~5, toujours la première et la dernière.
    const step = Math.max(1, Math.ceil(points.length / 5));
    const xLabels = points.map((p, i) => {
      if (i % step !== 0 && i !== points.length - 1) return '';
      if (i !== points.length - 1 && points.length - 1 - i < step / 2) return '';
      const anchor = i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle';
      return `<text class="axis" x="${x(i)}" y="${H - 6}" text-anchor="${anchor}">${monthShort(p.m)}</text>`;
    }).join('');

    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.cum).toFixed(1)}`).join('');
    const area = `${line}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;

    box.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Évolution du total investi">
        ${grid}
        <path class="area" d="${area}"></path>
        <path class="line" d="${line}"></path>
        ${xLabels}
        <g id="hover" visibility="hidden">
          <line class="cross" y1="${pad.t}" y2="${pad.t + ih}"></line>
          <circle class="dot" r="5"></circle>
        </g>
        <rect x="${pad.l}" y="0" width="${iw}" height="${H}" fill="transparent" id="hit"></rect>
      </svg>
      <div class="tip" id="tip" hidden></div>`;
    chartData = { points, x, y, W };

    const hit = $('hit');
    const show = (ev) => {
      const rect = box.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * W;
      let best = 0;
      points.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
      showPoint(best);
    };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') hidePoint(); });
  }

  function showPoint(i) {
    const { points, x, y, W } = chartData;
    const p = points[i];
    const g = $('hover');
    g.setAttribute('visibility', 'visible');
    g.querySelector('line').setAttribute('x1', x(i));
    g.querySelector('line').setAttribute('x2', x(i));
    g.querySelector('circle').setAttribute('cx', x(i));
    g.querySelector('circle').setAttribute('cy', y(p.cum));

    const tip = $('tip');
    const detail = tab === 'total'
      ? `<div><span>dont crypto</span><b>${euro.format(p.crypto)}</b></div><div><span>dont bourse</span><b>${euro.format(p.bourse)}</b></div>`
      : '';
    tip.innerHTML = `<div class="m">${escapeHtml(monthLabel(p.m))}</div>
      <div><span>Investi ce mois</span><b>${euro.format(p.added)}</b></div>${detail}
      <div><span>Total cumulé</span><b>${euro.format(p.cum)}</b></div>`;
    tip.hidden = false;
    const boxW = $('chart').clientWidth;
    const px = (x(i) / W) * boxW;
    const left = px + 12 + tip.offsetWidth > boxW ? px - 12 - tip.offsetWidth : px + 12;
    tip.style.left = `${Math.max(0, left)}px`;
  }
  function hidePoint() {
    const g = $('hover'); if (g) g.setAttribute('visibility', 'hidden');
    const tip = $('tip'); if (tip) tip.hidden = true;
  }

  function niceMax(v) {
    if (v <= 0) return 100;
    const p = 10 ** Math.floor(Math.log10(v));
    for (const k of [1.5, 3, 6, 9, 12]) if (k * p >= v) return k * p; // divisible en 3 intervalles ronds
    return 15 * p;
  }

  // ----- Historique -----
  function renderHistory(entries) {
    const colors = tab === 'total' ? null : assetColors(entries);
    const byMonth = {};
    entries.forEach((e) => { (byMonth[e.month] ||= []).push(e); });
    const months = Object.keys(byMonth).sort().reverse();

    $('history').innerHTML = months.map((m) => {
      const list = byMonth[m];
      let rows;
      if (tab === 'total') {
        rows = ['crypto', 'bourse'].map((k) => {
          const s = sum(list.filter((e) => e.kind === k));
          return s ? `<div class="entry"><span class="sw" style="background:${KIND_COLORS[k]}"></span>
            <span class="name">${TABS[k]}</span><span class="amt">${euro.format(s)}</span></div>` : '';
        }).join('');
      } else {
        rows = list.map((e) => `
          <div class="entry${e.id === editingId ? ' editing' : ''}">
            <span class="sw" style="background:${colors[e.asset].color}"></span>
            <span class="name">${escapeHtml(e.asset)}</span>
            ${e.qty ? `<span class="qty">${qtyFmt.format(e.qty)}</span>` : ''}
            <span class="amt">${euro.format(e.amount)}</span>
            <button class="icon-btn edit" data-id="${e.id}" aria-label="Modifier">✎</button>
            <button class="icon-btn del" data-id="${e.id}" aria-label="Supprimer">×</button>
          </div>`).join('');
      }
      return `<div class="month">
        <div class="month-head"><span>${escapeHtml(monthLabel(m))}</span><span>${euro.format(sum(list))}</span></div>
        ${rows}</div>`;
    }).join('');
    $('emptyHistory').hidden = months.length > 0;
  }

  // ---------- Liste d'actifs ----------
  const lastAsset = {};
  const catalogItem = (t, sym) => (CATALOG[t] || []).find((c) => c.sym === sym);

  function renderAssetSelect() {
    const sel = $('assetSelect');
    const catalog = CATALOG[tab] || [];
    const own = [...new Set(state[tab].map((e) => e.asset))]
      .filter((a) => !catalogItem(tab, a)).sort();
    const opt = (v, label) => `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;
    sel.innerHTML =
      (own.length ? `<optgroup label="Mes autres actifs">${own.map((a) => opt(a, a)).join('')}</optgroup>` : '') +
      `<optgroup label="${tab === 'crypto' ? 'Cryptos' : 'ETF et indices'}">` +
      catalog.map((c) => opt(c.sym, `${c.sym} — ${c.name}`)).join('') + '</optgroup>' +
      opt(OTHER, 'Autre… (saisir le nom)');
    const wanted = lastAsset[tab];
    sel.value = wanted && [...sel.options].some((o) => o.value === wanted) ? wanted : (catalog[0] ? catalog[0].sym : OTHER);
    onAssetChange();
  }

  function selectedAsset() {
    const v = $('assetSelect').value;
    if (v !== OTHER) return v;
    return $('assetCustom').value.trim().toUpperCase();
  }

  function onAssetChange() {
    const other = $('assetSelect').value === OTHER;
    $('customWrap').hidden = !other;
    $('assetCustom').required = other;
    lastAsset[tab] = $('assetSelect').value;
    renderQtyHint();
  }

  /** Propose la quantité calculée au cours actuel (utile pour un achat du jour). */
  function renderQtyHint() {
    const hint = $('qtyHint');
    const asset = selectedAsset();
    const amount = parseFloat(String($('amount').value).replace(',', '.'));
    const p = asset && priceOf(tab, asset);
    if (!p || !(amount > 0) || $('qty').value) { hint.hidden = true; return; }
    const q = amount / p.price;
    hint.innerHTML = `Au cours actuel (${priceFmt(p.price)}), ${euro.format(amount)} ≈ ${qtyFmt.format(q)} ${escapeHtml(asset)}` +
      `<button type="button" id="useQty">Utiliser</button>`;
    hint.dataset.q = String(+q.toPrecision(8));
    hint.hidden = false;
  }

  $('assetSelect').addEventListener('change', onAssetChange);
  $('amount').addEventListener('input', renderQtyHint);
  $('qty').addEventListener('input', renderQtyHint);
  $('qtyHint').addEventListener('click', (ev) => {
    if (ev.target.id !== 'useQty') return;
    $('qty').value = $('qtyHint').dataset.q;
    renderQtyHint();
  });

  // ---------- Cours ----------
  let live = (() => { try { return JSON.parse(localStorage.getItem(LIVE_KEY)) || {}; } catch (e) { return {}; } })();
  let liveError = false;
  let liveLoading = false;

  /** Cours d'un actif : en direct (cryptos de la liste) sinon saisi à la main. */
  function priceOf(t, asset) {
    const c = catalogItem(t, asset);
    if (c && c.cg && live.prices && live.prices[c.cg] != null) {
      return { price: live.prices[c.cg], at: live.at, auto: true };
    }
    if (t === 'bourse') {
      const tk = tickerOf(asset);
      const q = tk && eod.prices[tk];
      if (q) return { price: q.price, at: q.at, date: q.date, auto: true, ticker: tk };
    }
    const m = state.prices[t] && state.prices[t][asset];
    return m ? { price: m.price, at: m.at, auto: false } : null;
  }

  // ---------- Cours de bourse (EODHD) ----------
  let eodKey = localStorage.getItem(EOD_KEY) || '';
  let eod = (() => { try { return { prices: {}, errors: {}, ...JSON.parse(localStorage.getItem(EOD_LIVE)) }; } catch (e) { return { prices: {}, errors: {} }; } })();
  let eodLoading = false;
  let eodStatus = ''; // message d'erreur global (clé invalide, quota atteint…)

  const tickerOf = (asset) => (catalogItem('bourse', asset) || {}).eod || state.tickers.bourse[asset] || null;
  const saveEod = () => { try { localStorage.setItem(EOD_LIVE, JSON.stringify(eod)); } catch (e) { /* plein */ } };

  /** Récupère le dernier cours de clôture de chaque ETF détenu (1 appel API par ticker). */
  async function refreshBoursePrices(force = false) {
    if (!eodKey || eodLoading) return;
    const tickers = [...new Set(state.bourse.filter((e) => e.qty > 0).map((e) => tickerOf(e.asset)).filter(Boolean))];
    const lastTry = (t) => Math.max(eod.prices[t] ? eod.prices[t].at : 0, eod.errors[t] || 0);
    const due = tickers.filter((t) => force || Date.now() - lastTry(t) > EOD_MAX_AGE);
    if (!due.length) return;
    eodLoading = true;
    renderValue();
    try {
      // Passe par la fonction serveur /api/eod (EODHD bloque les appels directs depuis le navigateur).
      const url = `api/eod?t=${encodeURIComponent(due.join(','))}&key=${encodeURIComponent(eodKey)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (res.status === 401) eodStatus = 'Clé EODHD refusée : vérifiez-la dans les réglages ci-dessous.';
      else if (res.status === 402) eodStatus = 'Quota EODHD du jour atteint (20 appels) : derniers cours connus affichés.';
      else if (!res.ok) throw new Error(res.status);
      else eodStatus = '';
      const { results = {} } = await res.json().catch(() => ({}));
      Object.entries(results).forEach(([t, r]) => {
        if (r && typeof r.price === 'number') {
          eod.prices[t] = { price: r.price, date: r.date, at: Date.now() };
          delete eod.errors[t];
        } else if (r && r.error === 'not_found') {
          eod.errors[t] = Date.now();
        }
      });
    } catch (e) {
      eodStatus = 'Cours de bourse indisponibles (hors ligne ?) : derniers cours connus affichés.';
    }
    saveEod();
    eodLoading = false;
    render();
  }

  function renderEodSettings() {
    const card = $('eodCard');
    card.hidden = tab !== 'bourse';
    if (card.hidden) return;
    $('eodState').textContent = eodKey ? 'Clé enregistrée ✓' : 'Aucune clé : les cours se saisissent à la main.';
    $('eodState').className = eodKey ? 'up' : '';
    $('eodRemove').hidden = !eodKey;
    $('eodForm').hidden = !!eodKey && !$('eodCard').classList.contains('editing');
    $('eodEdit').hidden = !eodKey || !$('eodForm').hidden;
  }

  $('eodForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const k = $('eodInput').value.trim();
    if (!k) return;
    eodKey = k;
    localStorage.setItem(EOD_KEY, k);
    $('eodInput').value = '';
    $('eodCard').classList.remove('editing');
    eodStatus = '';
    renderEodSettings();
    await refreshBoursePrices(true);
  });
  $('eodEdit').addEventListener('click', () => { $('eodCard').classList.add('editing'); renderEodSettings(); $('eodInput').focus(); });
  $('eodRemove').addEventListener('click', () => {
    if (!confirm('Supprimer la clé EODHD de cet appareil ?')) return;
    eodKey = '';
    localStorage.removeItem(EOD_KEY);
    eodStatus = '';
    render();
  });

  async function refreshLivePrices(force = false) {
    const ids = [...new Set(state.crypto.map((e) => catalogItem('crypto', e.asset)).filter(Boolean).map((c) => c.cg))];
    if (!ids.length || liveLoading) return;
    const fresh = live.at && Date.now() - live.at < LIVE_MAX_AGE && ids.every((id) => live.prices && id in live.prices);
    if (fresh && !force) return;
    liveLoading = true;
    renderValue();
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=eur`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      const prices = { ...(live.prices || {}) };
      Object.entries(data).forEach(([id, v]) => { if (v && typeof v.eur === 'number') prices[id] = v.eur; });
      live = { at: Date.now(), prices };
      localStorage.setItem(LIVE_KEY, JSON.stringify(live));
      liveError = false;
    } catch (e) {
      liveError = true;
    } finally {
      liveLoading = false;
      render();
    }
  }

  /** Positions (quantité détenue, valeur, plus-value) par actif pour un onglet. */
  function positionsFor(t) {
    const byAsset = {};
    state[t].forEach((e) => {
      const p = (byAsset[e.asset] ||= { asset: e.asset, kind: t, qty: 0, cost: 0, invested: 0 });
      p.invested += e.amount;
      if (e.qty > 0) { p.qty += e.qty; p.cost += e.amount; }
    });
    return Object.values(byAsset).filter((p) => p.qty > 0).map((p) => {
      const pr = priceOf(t, p.asset);
      const value = pr ? p.qty * pr.price : null;
      return { ...p, price: pr, value, pnl: value === null ? null : value - p.cost };
    });
  }

  /** Synthèse : valeur des positions avec cours connu, et ce qu'elles ont coûté. */
  function summary(kinds) {
    const pos = kinds.flatMap(positionsFor);
    const priced = pos.filter((p) => p.value !== null);
    const value = priced.reduce((s, p) => s + p.value, 0);
    const cost = priced.reduce((s, p) => s + p.cost, 0);
    const noQty = kinds.reduce((s, k) => s + sum(state[k].filter((e) => !(e.qty > 0))), 0);
    return { pos, priced, value, cost, pnl: value - cost, missing: pos.filter((p) => p.value === null), noQty };
  }

  function pnlHtml(pnl, cost) {
    if (!cost) return '';
    const cls = pnl > 0 ? 'up' : pnl < 0 ? 'down' : '';
    const arrow = pnl > 0 ? '▲' : pnl < 0 ? '▼' : '';
    return `<em class="${cls}">${arrow} ${signedEuro(pnl)} (${pnlPctFmt.format(pnl / cost)})</em>`;
  }

  function renderValue() {
    const kinds = tab === 'total' ? ['crypto', 'bourse'] : [tab];
    const s = summary(kinds);

    // Tuile d'en-tête
    $('valueTile').hidden = s.priced.length === 0;
    $('valueNow').textContent = euroRound.format(s.value);
    $('pnl').textContent = s.cost
      ? `${s.pnl > 0 ? '▲' : s.pnl < 0 ? '▼' : ''} ${signedEuro(s.pnl)} (${pnlPctFmt.format(s.pnl / s.cost)})`
      : '';
    $('pnl').className = s.pnl > 0 ? 'up' : s.pnl < 0 ? 'down' : '';

    // Carte détaillée
    $('valueCard').hidden = s.pos.length === 0 && s.noQty === 0;
    const canCrypto = kinds.includes('crypto') && state.crypto.some((e) => catalogItem('crypto', e.asset));
    const canBourse = kinds.includes('bourse') && !!eodKey && state.bourse.some((e) => e.qty > 0 && tickerOf(e.asset));
    $('refreshBtn').hidden = !canCrypto && !canBourse;
    $('refreshBtn').disabled = liveLoading || eodLoading;
    $('refreshBtn').textContent = liveLoading || eodLoading ? 'Mise à jour…' : '↻ Actualiser';

    const info = [];
    if (kinds.includes('crypto') && live.at) info.push(`Cours crypto : CoinGecko, ${timeFmt.format(new Date(live.at))}.`);
    if (liveError) info.push('Cours en direct indisponibles (hors ligne ?) : derniers cours connus affichés.');
    if (kinds.includes('bourse') && state.bourse.some((e) => e.qty > 0)) {
      const dates = Object.values(eod.prices).map((q) => q.date).filter(Boolean).sort();
      if (eodKey && dates.length) info.push(`Cours bourse : clôture du ${dayFmt.format(new Date(dates[dates.length - 1]))} (EODHD).`);
      if (eodStatus) info.push(eodStatus);
      const bad = [...new Set(state.bourse.map((e) => tickerOf(e.asset)).filter((t) => t && eod.errors[t]))];
      if (eodKey && bad.length) info.push(`Ticker introuvable : ${bad.join(', ')}.`);
      if (state.bourse.some((e) => e.qty > 0 && !priceOf('bourse', e.asset)?.auto)) {
        info.push('Touchez un cours souligné pour le saisir à la main.');
      }
    }
    $('priceInfo').textContent = info.join(' ');
    $('priceInfo').hidden = info.length === 0;

    const colors = tab === 'total' ? null : assetColors(entriesFor(tab));
    const rows = s.pos.sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).map((p) => {
      const color = colors ? (colors[p.asset] || {}).color : KIND_COLORS[p.kind];
      const priceLabel = p.price ? priceFmt(p.price.price) : 'Saisir le cours';
      const priceTitle = p.price && !p.price.auto ? ` (saisi le ${dateTimeFmt.format(new Date(p.price.at))})` : '';
      const priceEl = p.price && p.price.auto
        ? `<span title="${p.price.ticker ? `${escapeHtml(p.price.ticker)}, clôture du ${escapeHtml(p.price.date)}` : 'Cours en direct'}">${priceLabel}</span>`
        : `<button type="button" class="price-btn${p.price ? '' : ' missing'}" data-kind="${p.kind}" data-asset="${escapeHtml(p.asset)}" title="Modifier le cours${priceTitle}">${priceLabel}</button>`;
      const partial = p.cost < p.invested ? ` · ${euro.format(p.invested - p.cost)} sans quantité` : '';
      return `<div class="pos">
        <div class="pos-top">
          <span class="sw" style="background:${color || OTHER_COLOR}"></span>
          <span class="name">${escapeHtml(p.asset)}</span>
          <b>${p.value === null ? '—' : euro.format(p.value)}</b>
        </div>
        <div class="pos-bot">
          <span class="grow">${qtyFmt.format(p.qty)} × ${priceEl}</span>
          ${p.value === null ? '' : pnlHtml(p.pnl, p.cost)}
        </div>
        <div class="pos-bot"><span>Payé ${euro.format(p.cost)}${partial}</span></div>
      </div>`;
    }).join('');
    $('positions').innerHTML = rows || '<p class="empty">Ajoutez la quantité achetée à vos investissements pour suivre leur valeur.</p>';

    $('noQtyInfo').hidden = !(s.noQty > 0 && s.pos.length > 0);
    $('noQtyInfo').textContent = `${euro.format(s.noQty)} investis sans quantité ne sont pas pris en compte. Touchez ✎ dans l'historique pour l'ajouter.`;
  }

  $('refreshBtn').addEventListener('click', () => { refreshLivePrices(true); refreshBoursePrices(true); });
  $('positions').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.price-btn');
    if (!btn) return;
    const { kind, asset } = btn.dataset;
    const cur = state.prices[kind][asset];
    const canLink = kind === 'bourse' && !catalogItem('bourse', asset);
    const question = canLink
      ? `Cours actuel de ${asset} en € (ex. 95,40)\nou ticker EODHD pour une mise à jour automatique (ex. AIR.PA) :`
      : `Cours actuel de ${asset} (en €) :`;
    const v = prompt(question, cur ? String(cur.price).replace('.', ',') : (state.tickers.bourse[asset] || ''));
    if (v === null) return;
    const txt = v.trim().toUpperCase();
    if (canLink && TICKER_RE.test(txt)) { // « 95.40 » n'est pas un ticker : le suffixe doit être en lettres
      state.tickers.bourse[asset] = txt;
      delete eod.errors[txt];
      save();
      render();
      if (eodKey) refreshBoursePrices(true);
      else alert('Ticker enregistré. Ajoutez une clé EODHD (carte « Cours de bourse automatiques ») pour récupérer le cours.');
      return;
    }
    const price = parseFloat(txt.replace(/\s/g, '').replace(',', '.'));
    if (!(price > 0)) { alert('Cours invalide.'); return; }
    state.prices[kind][asset] = { price, at: Date.now() };
    save();
    render();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshLivePrices(); refreshBoursePrices(); } });

  // ---------- Actions ----------
  function resetForm() {
    editingId = null;
    $('amount').value = '';
    $('qty').value = '';
    $('assetCustom').value = '';
  }

  $('month').value = currentMonth();
  $('month').addEventListener('change', renderRepeat);

  $('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const amount = Math.round(parseFloat(String($('amount').value).replace(',', '.')) * 100) / 100;
    const asset = selectedAsset();
    const month = $('month').value;
    const qty = parseFloat(String($('qty').value).replace(',', '.'));
    if (!asset) { $('assetCustom').focus(); return; }
    if (!month || !(amount > 0)) return;
    const data = { month, asset, amount };
    if (qty > 0) data.qty = qty;
    if (editingId) {
      const e = state[tab].find((x) => x.id === editingId);
      if (e) { delete e.qty; Object.assign(e, data); }
    } else {
      state[tab].push({ id: uid(), ...data });
    }
    lastAsset[tab] = asset;
    save();
    resetForm();
    render();
    refreshLivePrices();
    refreshBoursePrices();
  });

  $('cancelBtn').addEventListener('click', () => { resetForm(); $('month').value = currentMonth(); render(); });

  $('repeatBtn').addEventListener('click', () => {
    const src = repeatSource();
    if (!src) return;
    src.items.forEach((e) => state[tab].push({ id: uid(), month: src.to, asset: e.asset, amount: e.amount }));
    save();
    render();
  });

  $('history').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.icon-btn');
    if (!btn) return;
    const entry = state[tab].find((e) => e.id === btn.dataset.id);
    if (!entry) return;
    if (btn.classList.contains('edit')) {
      editingId = entry.id;
      $('month').value = entry.month;
      $('amount').value = entry.amount;
      $('qty').value = entry.qty || '';
      lastAsset[tab] = entry.asset;
      render();
      $('formCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!confirm(`Supprimer ${entry.asset} — ${euro.format(entry.amount)} ?`)) return;
    state[tab] = state[tab].filter((e) => e.id !== entry.id);
    if (editingId === entry.id) resetForm();
    save();
    render();
  });

  document.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      if (tab === b.dataset.tab) return;
      tab = b.dataset.tab;
      focusKey = null;
      resetForm();
      localStorage.setItem(STORAGE_KEY + ':tab', tab);
      render();
      window.scrollTo({ top: 0 });
    }));

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderChart(entriesFor(tab)), 150);
  });

  // ----- Sauvegarde -----
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `invest-track-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('importInput').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const valid = (list) => Array.isArray(list) && list.every((e) =>
        e && typeof e.asset === 'string' && typeof e.amount === 'number' && /^\d{4}-\d{2}$/.test(e.month)
        && (e.qty === undefined || typeof e.qty === 'number'));
      if (!valid(data.crypto) || !valid(data.bourse)) throw new Error('format');
      if (!confirm('Remplacer les données actuelles par celles du fichier ?')) return;
      ['crypto', 'bourse'].forEach((k) => data[k].forEach((e) => { e.id ||= uid(); }));
      state = {
        crypto: data.crypto, bourse: data.bourse,
        prices: { crypto: {}, bourse: {}, ...(data.prices || {}) },
        tickers: { bourse: {}, ...(data.tickers || {}) },
      };
      resetForm();
      save();
      render();
    } catch (e) {
      alert("Ce fichier n'est pas une sauvegarde Invest Track valide.");
    }
  });

  render();
  refreshLivePrices();
  refreshBoursePrices();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
  }
})();
