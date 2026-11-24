// Liste des actifs proposés dans le formulaire.
// `cg` = identifiant CoinGecko, utilisé pour récupérer le cours en direct.
window.CATALOG = {
  crypto: [
    { sym: 'BTC', name: 'Bitcoin', cg: 'bitcoin' },
    { sym: 'ETH', name: 'Ethereum', cg: 'ethereum' },
    { sym: 'SOL', name: 'Solana', cg: 'solana' },
    { sym: 'BNB', name: 'BNB', cg: 'binancecoin' },
    { sym: 'XRP', name: 'XRP', cg: 'ripple' },
    { sym: 'ADA', name: 'Cardano', cg: 'cardano' },
    { sym: 'DOGE', name: 'Dogecoin', cg: 'dogecoin' },
    { sym: 'TRX', name: 'Tron', cg: 'tron' },
    { sym: 'TON', name: 'Toncoin', cg: 'the-open-network' },
    { sym: 'AVAX', name: 'Avalanche', cg: 'avalanche-2' },
    { sym: 'LINK', name: 'Chainlink', cg: 'chainlink' },
    { sym: 'DOT', name: 'Polkadot', cg: 'polkadot' },
    { sym: 'SUI', name: 'Sui', cg: 'sui' },
    { sym: 'LTC', name: 'Litecoin', cg: 'litecoin' },
    { sym: 'XLM', name: 'Stellar', cg: 'stellar' },
    { sym: 'ATOM', name: 'Cosmos', cg: 'cosmos' },
    { sym: 'NEAR', name: 'Near', cg: 'near' },
    { sym: 'SHIB', name: 'Shiba Inu', cg: 'shiba-inu' },
    { sym: 'PEPE', name: 'Pepe', cg: 'pepe' },
    { sym: 'POL', name: 'Polygon', cg: 'polygon-ecosystem-token' },
    { sym: 'USDC', name: 'USD Coin', cg: 'usd-coin' },
    { sym: 'USDT', name: 'Tether', cg: 'tether' },
  ],
  // `eod` = ticker EODHD (cours de clôture automatiques si une clé API est enregistrée).
  // Les indices n'ont pas de ticker : on investit via un support dont le cours se saisit à la main.
  bourse: [
    { sym: 'CW8', name: 'Amundi MSCI World', eod: 'CW8.PA' },
    { sym: 'WPEA', name: 'iShares MSCI World (PEA)', eod: 'WPEA.PA' },
    { sym: 'DCAM', name: 'Amundi PEA Monde (MSCI World)', eod: 'DCAM.PA' },
    { sym: 'ESE', name: 'BNP Paribas Easy S&P 500 (PEA)', eod: 'ESE.PA' },
    { sym: 'PE500', name: 'Amundi PEA S&P 500', eod: 'PE500.PA' },
    { sym: 'PUST', name: 'Amundi PEA Nasdaq-100', eod: 'PUST.PA' },
    { sym: 'C40', name: 'Amundi CAC 40', eod: 'C40.PA' },
    { sym: 'PAEEM', name: 'Amundi PEA Marchés Émergents', eod: 'PAEEM.PA' },
    { sym: 'CAC40', name: 'CAC 40 (indice / autre support)' },
    { sym: 'S&P500', name: 'S&P 500 (indice / autre support)' },
    { sym: 'NASDAQ100', name: 'Nasdaq-100 (indice / autre support)' },
    { sym: 'MSCIWORLD', name: 'MSCI World (indice / autre support)' },
  ],
};
