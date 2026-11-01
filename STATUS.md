# Projektstatus

**Projekt:** FPV Down – 3D-försvarssimulator mot FPV-drönare i webbläsaren
**Uppdaterad:** 2026-11-01

## Mål och avgränsning

- **Mål:** Lyfta spelets 3D-grafik, modeller, material, himmel, belysning och visuella effekter från enkla blockformer till en sammanhängande, detaljerad 3D-miljö.
- **Omfattning:** Renderingspipeline, himmel/belysning, terräng och växtlighet, försvarsställning och byggnader, alla tre vapenmodeller, drönarmodeller samt explosions- och spårljuseffekter.
- **Klart när:** Nya modeller, texturer, himmel och effekter är på plats, `npm test`, `npm run build` och webbläsarkontrollerna passerar, samt ändringarna är committade och pushade. Detaljer i [docs/krav.md](docs/krav.md).

## Nuläge

- Komplett grafisk omarbetning och prestandaoptimering genomförd och verifierad med enhetstester, produktionsbygge, webbläsarkontroller och belastningsmätning (60 FPS / ~16,7 ms median vid 24 aktiva drönare, 117 geometribuffertar).

## Bekräftade beslut

- 2026-11-01: Behåll spelområdet (`r < 85 m`) plant så att befintlig kollision och spelmekanik är oförändrad; lägg topografi med kullar utanför stridsområdet. Detaljer i [docs/losning.md](docs/losning.md).
- 2026-11-01: Generera ytskikt (betong, korrugerad plåt, puts, trä, säckväv, sten) och partikel-/rotortexturer procedurellt vid start för att undvika externa bildberoenden.

## Relevanta filer och underlag

- `src/sky.js` – procedurell himmelskupol med sol och drivande moln.
- `src/textures.js` – procedurella canvas- och bumptexturer för världens material.
- `src/world.js` – kuperad horisont, grästuvor, skog, detaljerad försvarsställning och byggnader.
- `src/weapon-view.js` – detaljerade 3D-modeller för M12, AK5-C och CAR-15.
- `src/drone.js` – kolfiberram, motorer, rotorskivor, batteri, verkansdel och status-LED.
- `src/effects.js` – mjuka partiklar för eldklot, rök, gnistor och splitter inom fasta poolgränser.
- `src/game.js` och `src/settings.js` – MSAA på postprocessmål och färggradering/vinjett.

## Kontroller och verifiering

- **Genomfört:** `npm test` (25/25 gröna), `npm run build`, `tools/browser-checks.js` samt visuell granskning i headless Chromium. Detaljer i [docs/verifiering.md](docs/verifiering.md).
- **Återstår:** Inga utestående kontroller för detta uppdrag.

## Öppna frågor och antaganden

- **Hinder:** Inga kända.

## Nästa steg

1. Eventuell fortsatt balansering av senare drönarvågor efter längre spelsessioner.
