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
- **Prestandaoptimering utan kvalitetsförlust (K-05):**
  1. *Delade drönarresurser och snabb raycast (`src/drone.js`, `src/game.js`):* Alla statiska drönardelar slås ihop per drönartyp till ett fåtal gemensamma `BufferGeometry` och delade material i stället för att klonas och frigöras vid varje spawn/död. En osynlig träffbox (`hitBox`) per drönare används som skottmål i `raycaster`, vilket minskar raycast-objekten per drönare från ~30 till 1.
  2. *Förbakad molntextur och djupklippning i himlen (`src/sky.js`):* Det S-periodiska FBM-bruset förbakas vid start till en sömlös `DataTexture` (256×256) och himmelskupolen ritas med `depthTest: true` och `DepthFormat`/`LessEqualDepth` på `z = w`, så att himlen hoppas över bakom terräng, vapen och byggnader och bara gör två texturuppslag per synlig himmelspixel.
  3. *Färre fullskärmspass (`src/game.js`, `src/style.css`):* Det separata `GradeShader`-passet i `EffectComposer` ersätts av direkt tonmappnings- och kontrasthantering samt befintlig CSS-vinjett, vilket sparar en hel fullskärmskopia per bildruta.
  4. *Skuggbudget och sammanslagen världsgeometri (`src/world.js`):* Statisk smågeometri på byggnader, vakttorn, container och antenn slås ihop per material med `mergeGeometries`. Skogsträd utanför skuggkamerans låda (`r > 82 m`) och grästuvor läggs i separata instanser utan `castShadow`/`receiveShadow`.
  5. *Grästuvor (`src/world.js`):* Varje strå byggs av en enkel avsmalnande triangel (3 hörn i stället för 9) med samma höjd och färgtoning.

Aktuella beslut finns i [../STATUS.md](../STATUS.md). Genomförda kontroller finns i [verifiering.md](verifiering.md).

## Ändringslogg

- 2026-11-01, v1.0: Dokumenterad grafisk omarbetning.
