(() => {
  const STORAGE_KEY = 'invest-track:v1';
  const TABS = { crypto: 'Crypto', bourse: 'Bourse' };
  const PLACEHOLDERS = { crypto: 'BTC, SOL…', bourse: 'CAC40, S&P500…' };

  const $ = (id) => document.getElementById(id);
  const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const monthFmt = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

  // ---- Données ----
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
  let tab = localStorage.getItem(STORAGE_KEY + ':tab') in TABS
    ? localStorage.getItem(STORAGE_KEY + ':tab') : 'crypto';

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const currentMonth = () => new Date().toISOString().slice(0, 7);
  const monthLabel = (ym) => {
    const [y, m] = ym.split('-').map(Number);
    return monthFmt.format(new Date(y, m - 1, 1));
  };
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---- Rendu ----
  function render() {
    const entries = state[tab];
    document.body.className = tab;
    $('title').textContent = TABS[tab];
    $('asset').placeholder = PLACEHOLDERS[tab];
    document.querySelectorAll('.tabs button').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.tab === tab)));

    const total = entries.reduce((s, e) => s + e.amount, 0);
    $('total').textContent = euro.format(total);

    // Totaux par actif
    const byAsset = {};
    entries.forEach((e) => { byAsset[e.asset] = (byAsset[e.asset] || 0) + e.amount; });
    const assets = Object.entries(byAsset).sort((a, b) => b[1] - a[1]);
    const max = assets.length ? assets[0][1] : 1;
    $('byAsset').innerHTML = assets.map(([name, sum]) => `
      <li>
        <div class="head">
          <span>${escapeHtml(name)}<span class="pct">${Math.round((sum / total) * 100)} %</span></span>
          <b>${euro.format(sum)}</b>
        </div>
        <div class="bar"><i style="width:${(sum / max) * 100}%"></i></div>
      </li>`).join('');
    $('emptyAsset').hidden = assets.length > 0;

    // Suggestions d'actifs déjà utilisés
    $('assets').innerHTML = Object.keys(byAsset).sort()
      .map((a) => `<option value="${escapeHtml(a)}">`).join('');

    // Historique par mois
    const byMonth = {};
    entries.forEach((e) => { (byMonth[e.month] ||= []).push(e); });
    const months = Object.keys(byMonth).sort().reverse();
    $('history').innerHTML = months.map((m) => {
      const list = byMonth[m];
      const sum = list.reduce((s, e) => s + e.amount, 0);
      return `
        <div class="month">
          <div class="month-head"><span>${monthLabel(m)}</span><span>${euro.format(sum)}</span></div>
          ${list.map((e) => `
            <div class="entry">
              <span class="name">${escapeHtml(e.asset)}</span>
              <span class="amt">${euro.format(e.amount)}</span>
              <button class="del" data-id="${e.id}" aria-label="Supprimer">×</button>
            </div>`).join('')}
        </div>`;
    }).join('');
    $('emptyHistory').hidden = months.length > 0;
  }

  // ---- Événements ----
  $('month').value = currentMonth();

  $('form').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const amount = Math.round(parseFloat($('amount').value.replace(',', '.')) * 100) / 100;
    const asset = $('asset').value.trim().toUpperCase();
    const month = $('month').value;
    if (!asset || !month || !(amount > 0)) return;
    state[tab].push({ id: uid(), month, asset, amount });
    save();
    $('asset').value = '';
    $('amount').value = '';
    render();
    $('asset').focus();
  });

  $('history').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.del');
    if (!btn) return;
    const entry = state[tab].find((e) => e.id === btn.dataset.id);
    if (!entry || !confirm(`Supprimer ${entry.asset} — ${euro.format(entry.amount)} ?`)) return;
    state[tab] = state[tab].filter((e) => e.id !== entry.id);
    save();
    render();
  });

  document.querySelectorAll('.tabs button').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      localStorage.setItem(STORAGE_KEY + ':tab', tab);
      render();
      window.scrollTo({ top: 0 });
    }));

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
