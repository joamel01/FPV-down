# FPV Down - verifiering

**Dokumentstatus:** Kontroller genomförda (2026-11-01).

## Förutsättningar

- **Version/leverans:** Aktuellt arbetsträd i `main`.
- **Miljö/metod:** Windows, Node.js v20.12.2, Vite v6.4.3 och headless Chromium via `agent-browser`.
- **Kontrollunderlag:** `tests/game.test.js`, `tests/systems.test.js` samt `tools/browser-checks.js`.

## Kontroller

| ID | Krav/risk | Miljö och metod | Förväntat resultat | Utfall och belägg | Datum/version |
| --- | --- | --- | --- | --- | --- |
| V-01 | K-04: Spelmekanik, eldhastighet, kollision, inställningar och effektpooler | `npm test` (`node --test`) | Alla 25 tester passerar | Godkänd (25/25 pass) | 2026-11-01 |
| V-02 | K-04: Produktionsbygge och paketering | `npm run build` (`vite build`) | Bygget slutförs utan fel och skapar `dist/` | Godkänd (`dist/` genererad) | 2026-11-01 |
| V-03 | K-01..K-04: Webbläsarkontroller och GPU-minnesdisciplin | `tools/browser-checks.js` i headless Chromium | Samtliga 11 runtimekontroller passerar och geometriräknaren är konstant efter uppvärmning | Godkänd | 2026-11-01 |
| V-04 | K-01..K-03: Visuell granskning av himmel, terräng, byggnader, alla tre vapen, drönare och explosioner | Skärmbilder i Chromium (`1600×900`) | Tydlig visuell förbättring utan WebGL- eller konsolfel | Godkänd | 2026-11-01 |
| V-05 | K-05: Prestandamätning med 24 drönare i Hög/Medel/Låg | Headless Chromium (`1600×900`) | Låg bildtid och fast geometrimängd (117 geometrier; Hög: 406 ritanrop / 16,7 ms median; Medel: 330 ritanrop / 16,6 ms median, 16,9 ms P95; Låg: 195 ritanrop / 16,7 ms median, 16,8 ms P95) | Godkänd | 2026-11-01 |

## Avvikelser och återstående verifiering

- Inga kända avvikelser. Äldre prestandamätningar finns i [verification.md](verification.md).

## Ändringslogg

- 2026-11-01, v1.0: Genomförda enhets-, bygg- och webbläsarkontroller efter grafisk omarbetning.
