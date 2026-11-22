# Invest Track

Une petite application web progressive (PWA) pour suivre l'argent investi chaque mois, avec deux onglets :

- **Crypto** : par exemple, en novembre, 50 € de BTC et 20 € de SOL
- **Bourse** : ETF, actions, etc.

- **Total** : crypto + bourse réunies

Pour chaque onglet, l'application affiche :

- le total investi, le total de l'année en cours et la moyenne mensuelle ;
- un camembert de la répartition (par actif, ou crypto / bourse dans l'onglet Total) ;
- un graphique de l'évolution du total investi cumulé ;
- l'historique mois par mois. Chaque ligne peut être modifiée (✎) ou supprimée (×).

## Quantité et valeur actuelle

- L'actif se choisit dans une **liste** (principales cryptos, ETF et indices courants). « Autre… » permet d'en saisir un nouveau.
- Pour chaque investissement, vous pouvez indiquer la **quantité achetée** (optionnel). L'application propose la quantité calculée au cours du jour.
- La carte **Valeur actuelle** affiche, pour chaque actif, la quantité détenue × le cours, la valeur et la plus- ou moins-value.
  - **Cryptos de la liste** : cours en direct via l'API gratuite [CoinGecko](https://www.coingecko.com/), rafraîchis à l'ouverture (au plus toutes les 5 min) ou avec « ↻ Actualiser ».
  - **Bourse et actifs « Autre »** : touchez le cours pour le saisir à la main (il n'existe pas d'API de cours boursiers gratuite utilisable directement depuis le navigateur).
- Les montants investis sans quantité ne sont pas comptés dans la valeur actuelle.

Le bouton **↻ Répéter** recopie en un geste les investissements du mois précédent dans le mois sélectionné.

## Fonctionnement

- HTML, CSS et JavaScript simples, sans dépendances ni étape de build.
- Les données sont enregistrées dans le navigateur (`localStorage`), uniquement sur l'appareil. Utilisez **Exporter** / **Importer** pour faire une sauvegarde ou passer d'un appareil à l'autre.
- L'application fonctionne hors ligne grâce au service worker et peut être installée sur l'écran d'accueil.

## Mise en ligne (GitHub Pages)

1. Sur GitHub, ouvrez **Settings → Pages**.
2. Dans *Source*, choisissez **Deploy from a branch**, puis la branche `main` et le dossier `/ (root)`.
3. L'application sera disponible à l'adresse `https://elgrnd.github.io/invest-track/`.
4. Sur votre téléphone, ouvrez ce lien, puis :
   - **Android / Chrome** : menu ⋮ → *Installer l'application*
   - **iPhone / Safari** : bouton Partager → *Sur l'écran d'accueil*

## Tester en local

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```
