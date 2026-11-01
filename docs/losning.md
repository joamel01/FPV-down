# FPV Down - lösning

**Dokumentstatus:** Verifierad lösning (2026-11-01).

## Lösningsbild

Grafiken har lyfts genom en kombination av förbättrad postprocessing/belysning (K-01), procedurella texturer och mer detaljerad världsgeometri (K-02), samt ombyggda modeller för vapen, drönare och partikeleffekter (K-03), inom befintliga pool- och kollisionsramar (K-04).

## Delar och samband

| Del/fil | Ansvar eller innehåll | Underlag och beroenden |
| --- | --- | --- |
| `src/sky.js` | Shaderbaserad himmelskupol med sol och drivande FBM-moln | Three.js `ShaderMaterial` |
| `src/textures.js` | Procedurella canvas- och bumptexturer (betong, korrugerad plåt, trä, säckväv, puts, sten) | HTML5 Canvas, `THREE.CanvasTexture` |
| `src/world.js` | PMREM-miljöbelysning, kuperad horisont (`r > 85 m`), grästuvor, skog, Jersey-barriärer, vakttorn och byggnader | `src/collision.js`, `src/sky.js`, `src/textures.js` |
| `src/weapon-view.js` | Detaljerade modeller för M12 (spång, patronhållare, sikte), AK5-C och CAR-15 (bärhandtag, A2-korn, moderator, STANAG-magasin) | `RoundedBoxGeometry`, `src/config.js` |
| `src/drone.js` | Dubbla kolfiberplattor, kopparlindade motorer, rotorskivor, batteri med spännband, verkansdel och klassspecifika LED | `src/config.js` |
| `src/effects.js` | Mjuk radiell `DataTexture` för eldklot, rök, gnistor och splitter inom fasta poolgränser | Three.js |
| `src/game.js`, `src/settings.js` | `WebGLRenderTarget` med MSAA (4x/2x/0x per kvalitetsläge) och färggradering/vinjett före `OutputPass` | Three.js `EffectComposer` |

## Metod och vägval

- **Kollisionskompatibilitet:** `terrainHeight(x, z)` är exakt `0` inom `r < 85 m` så att spelarens ögonhöjd (`1.72 m`), drönarnas lägsta flyghöjd och alla AABB-hinder fungerar oförändrat.
- **Kantutjämning i postprocessing:** `EffectComposer` skapade tidigare render-targets utan multisampling, vilket gav taggiga kanter trots `antialias: true` på canvasen. Nu används `HalfFloatType` med MSAA styrt av kvalitetsinställningen.
- **Node-testbarhet:** `EffectsSystem` och `Drone` använder `THREE.DataTexture` i stället för DOM-canvas så att testerna kan köras direkt i Node.js utan webbläsar-DOM.

Aktuella beslut finns i [../STATUS.md](../STATUS.md). Genomförda kontroller finns i [verifiering.md](verifiering.md).

## Ändringslogg

- 2026-11-01, v1.0: Dokumenterad grafisk omarbetning.
