(() => {
  const STORAGE_KEY = 'invest-track:v1';
  const TABS = { crypto: 'Crypto', bourse: 'Bourse', total: 'Total' };
  const PLACEHOLDERS = { crypto: 'BTC, SOL…', bourse: 'CAC40, S&P500…' };
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

  // ---------- Données ----------
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (data && Array.isArray(data.crypto) && Array.isArray(data.bourse)) return data;
    } catch (e) { /* données absentes ou illisibles */ }
    return { crypto: [], bourse: [] };
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
      $('asset').placeholder = PLACEHOLDERS[tab];
      $('assets').innerHTML = [...new Set(entries.map((e) => e.asset))].sort()
        .map((a) => `<option value="${escapeHtml(a)}">`).join('');
      renderFormMode();
      renderRepeat();
    }

    $('splitTitle').textContent = tab === 'total' ? 'Crypto / Bourse' : 'Répartition par actif';
    renderDonut(slicesFor(entries), total);
    renderChart(entries);
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

  // ---------- Actions ----------
  function resetForm() {
    editingId = null;
    $('asset').value = '';
    $('amount').value = '';
  }

  $('month').value = currentMonth();
  $('month').addEventListener('change', renderRepeat);

  $('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const amount = Math.round(parseFloat(String($('amount').value).replace(',', '.')) * 100) / 100;
    const asset = $('asset').value.trim().toUpperCase();
    const month = $('month').value;
    if (!asset || !month || !(amount > 0)) return;
    if (editingId) {
      const e = state[tab].find((x) => x.id === editingId);
      if (e) Object.assign(e, { month, asset, amount });
    } else {
      state[tab].push({ id: uid(), month, asset, amount });
    }
    save();
    resetForm();
    render();
    $('asset').focus();
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
      $('asset').value = entry.asset;
      $('amount').value = entry.amount;
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
        e && typeof e.asset === 'string' && typeof e.amount === 'number' && /^\d{4}-\d{2}$/.test(e.month));
      if (!valid(data.crypto) || !valid(data.bourse)) throw new Error('format');
      if (!confirm('Remplacer les données actuelles par celles du fichier ?')) return;
      ['crypto', 'bourse'].forEach((k) => data[k].forEach((e) => { e.id ||= uid(); }));
      state = { crypto: data.crypto, bourse: data.bourse };
      resetForm();
      save();
      render();
    } catch (e) {
      alert("Ce fichier n'est pas une sauvegarde Invest Track valide.");
    }
  });

  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
  }
})();
