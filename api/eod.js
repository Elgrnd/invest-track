// Fonction serveur Vercel : récupère les cours de clôture EODHD à la place du navigateur.
// EODHD refuse les appels faits directement depuis une page web (CORS) ; ici l'appel part du
// serveur Vercel, sur le même domaine que l'application, donc sans blocage.
//
// GET /api/eod?t=CW8.PA,ESE.PA&key=CLE
//   - la clé peut aussi être définie côté serveur dans la variable d'environnement EODHD_KEY
//     (Vercel → Settings → Environment Variables) ; elle est alors prioritaire.
// Réponse : { results: { "CW8.PA": { price, date } | { error } } }
//   statut 401 = clé refusée, 402 = quota du jour atteint.

const TICKER = /^[A-Z0-9][A-Z0-9\-_]*\.[A-Z]{1,6}$/;

module.exports = async (req, res) => {
  const key = process.env.EODHD_KEY || String(req.query.key || '');
  if (!key) return res.status(400).json({ error: 'missing_key' });

  const tickers = [...new Set(String(req.query.t || '').toUpperCase().split(','))]
    .filter((t) => TICKER.test(t))
    .slice(0, 20);
  if (!tickers.length) return res.status(400).json({ error: 'no_ticker' });

  const from = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const results = {};
  let status = 200;

  for (const t of tickers) {
    try {
      const url = `https://eodhd.com/api/eod/${encodeURIComponent(t)}` +
        `?api_token=${encodeURIComponent(key)}&fmt=json&order=d&from=${from}`;
      const r = await fetch(url);
      if (r.status === 401 || r.status === 403) { status = 401; break; }
      if (r.status === 402 || r.status === 429) { status = 402; break; }
      if (r.status === 404) { results[t] = { error: 'not_found' }; continue; }
      if (!r.ok) { results[t] = { error: `upstream_${r.status}` }; continue; }
      const rows = await r.json();
      const last = Array.isArray(rows) && rows.find((x) => typeof x.close === 'number');
      results[t] = last ? { price: last.close, date: last.date } : { error: 'not_found' };
    } catch (e) {
      results[t] = { error: 'network' };
    }
  }

  // Le CDN de Vercel garde la réponse 1 h : économise le quota EODHD (20 appels/jour en gratuit).
  res.setHeader('Cache-Control', status === 200 ? 'public, s-maxage=3600' : 'no-store');
  res.status(status).json({ results });
};
