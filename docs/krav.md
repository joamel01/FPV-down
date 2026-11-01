# FPV Down - krav

**Dokumentstatus:** Fastställd (2026-11-01).

## Syfte och omfattning

Förbättra spelets visuella kvalitet i 3D-scenen (värld, himmel, belysning, vapen, drönare och effekter) utan att bryta spelmekanik, prestandagränser eller befintliga regressionstester.

## Krav

| ID | Krav eller regel | Källa/beslut | Acceptanskriterium |
| --- | --- | --- | --- |
| K-01 | Ersätt enfärgad himmel och enkla molnsfärer med himmelskupol, sol och moln samt matchande miljöbelysning | Uppdrag 2026-11-01 | Himmel med horisontgradient, sol och moln samt PMREM-reflexer syns i scenen |
| K-02 | Ersätt enkla lådbarriärer, platta gräsrektanglar och kubhus med detaljerade modeller, texturer och kuperad horisont | Uppdrag 2026-11-01 | Jersey-barriärer, fackverkstorn, hus med tak/fönster, skog och grästuvor renderas utan att ändra kollisionsboxar i stridsområdet |
| K-03 | Ge M12 och CAR-15 samma detaljnivå som AK5-C och förbättra drönarnas och explosionernas utseende | Uppdrag 2026-11-01 | Alla tre vapen samt samtliga drönarklasser och explosioner använder detaljerade modeller och mjuka partiklar |
| K-04 | Bevara befintliga funktions- och resurstester samt byggbarhet | Projektregler | `npm test`, `npm run build` och `tools/browser-checks.js` passerar |

## Förutsättningar och begränsningar

- Inga nya externa beroenden utöver befintlig Three.js och Vite.
- Effektpoolernas tak (256 partiklar, 24 spårljus, 6 ljus) och återanvändning av vapenmodeller ska gälla oförändrat.

## Ändringslogg

- 2026-11-01, v1.0: Krav fastställda för grafisk omarbetning.
