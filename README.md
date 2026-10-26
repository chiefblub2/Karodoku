# Karodoku

Generierte Mordrätsel im Murdoku-Stil – als statische Website für GitHub Pages, optimiert fürs Handy.

## Regeln

- In jeder Zeile und jeder Spalte steht genau eine Person (das Opfer zählt mit).
- Personen stehen auf freiem Boden, Stühlen, Betten, Teppichen oder in der Badewanne – nie auf Tischen, Pflanzen oder Regalen.
- Der Täter oder die Täterin war allein mit dem Opfer im Raum.
- Die Hinweise führen zu genau einer Lösung.

## Funktionen

- Rätsel werden im Browser aus einem Seed erzeugt (`?n=6&d=medium&s=abc123`), daher teilbar per Link
- Tagesrätsel (Seed = Datum), Größen 5×5 bis 8×8, drei Schwierigkeitsgrade
- Eindeutigkeit wird von einem Backtracking-Solver geprüft, die Hinweise werden auf eine minimale Menge reduziert
- Notizen (✕), Hinweise abhaken, Rückgängig, Prüfen, Tipps, Timer, Fortschritt in localStorage
- Deutsch / Englisch, Dark Mode

## Entwicklung

Kein Build-Schritt nötig:

```sh
python3 -m http.server 8000   # http://localhost:8000
node tests/generate.test.mjs  # Generator prüfen
```

## Struktur

| Datei | Inhalt |
| --- | --- |
| `js/generator.js` | Grundriss, versteckte Lösung, Möbel, Hinweise, Reduktion |
| `js/solver.js` | Lösungszähler (Backtracking mit MRV) |
| `js/model.js` | Möbel, Räume, Personen |
| `js/i18n.js` | Texte und Hinweis-Formulierungen (DE/EN) |
| `js/app.js` | Oberfläche und Spiellogik |

## Deployment

`.github/workflows/pages.yml` testet den Generator und veröffentlicht die Seite bei jedem Push auf `main`.
Einmalig in den Repo-Einstellungen unter **Settings → Pages → Source** „GitHub Actions" auswählen.
