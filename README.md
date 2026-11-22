# Invest Track

Une petite application web progressive (PWA) pour suivre l'argent investi chaque mois, avec deux onglets :

- **Crypto** : par exemple, en novembre, 50 € de BTC et 20 € de SOL
- **Bourse** : ETF, actions, etc.

Pour chaque onglet, l'application affiche le total investi, la répartition par actif et l'historique mois par mois.

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
