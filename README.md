# Karodoku

Generierte Mordrätsel – in Arbeit: 3D-Version als hölzernes Puppenhaus (Vite + TypeScript + Three.js).

## Entwicklung

```sh
npm install
npm run dev        # Entwicklungsserver
npm test           # Vitest: Eindeutigkeit, Minimalität, Determinismus, Generierungszeit
npm run build      # Typecheck + Produktions-Build nach dist/
```

## Deployment

Die Seite wird nicht mehr direkt aus dem Branch veröffentlicht, sondern per GitHub Actions gebaut
(`.github/workflows/deploy.yml`) – bei jedem Push auf `main`.
Dafür einmalig unter **Settings → Pages → Source** „GitHub Actions“ auswählen.
