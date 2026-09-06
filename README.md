# FPV Down

En modern förstapersonsbaserad 3D-försvarssimulator för webbläsaren. Spelaren försvarar en framskjuten position mot vågor av inkommande FPV-drönare med hagelgevär och automatkarbiner.

## Spelfunktioner

- Musstyrt förstapersonssikte och WASD-förflyttning med sprint.
- Tre vapen: M12 hagelgevär, AK5-C och CAR-15.
- Magasin, reservammunition, eldhastighet, spridning, rekyl och omladdning per vapen.
- Tre drönarklasser med olika hälsa, fart och skadeverkan.
- Kroppsbaserad kollision med glidning längs murar, sandsäckar, containrar och byggnader.
- Drönare undviker fasta hinder, håller avstånd till varandra och kan inte detonera genom väggar.
- Projektiler stoppas av fasta objekt, med synlig träffeffekt på materialet.
- Dynamiska vågor, poäng, träffsäkerhet, rustning och slutrapport.
- Passiv radar, modern taktisk HUD och träffmarkeringar.
- Three.js/WebGL med ACES-tonemapping, mjuka skuggor, dimma, bloom och PBR-material.
- Realistisk, projektbunden terrängtextur framtagen särskilt för spelet.
- Syntetiserade skott-, träff-, omladdnings-, rotor- och explosionsljud via Web Audio API.
- Sparade inställningar för grafikkvalitet, muskänslighet, inverterat sikte och tre ljudnivåer.
- Riktning på inkommande skada, varning för låg ammunition och synlig omladdningsanimation.
- Val mellan ammunition, sjukvård och skyddsväst efter varje överlevd våg.
- Återanvända vapenmodeller, begränsade effektpooler och instansierad skog.

## Kontroller

| Funktion | Kontroll |
| --- | --- |
| Förflyttning | `W`, `A`, `S`, `D` |
| Sikta | Mus |
| Skjut | Vänster musknapp |
| Sprint | `Shift` |
| Ladda om | `R` |
| Byt vapen | `1`, `2`, `3` eller mushjul |
| Paus | `Esc` |
| Inställningar | Knappen i start- eller pausmenyn |

## Inställningar och förstärkningar

Inställningarna gäller direkt och sparas lokalt i webbläsaren. Huvudvolymen
styr allt ljud; effekter och drönarnas rotorljud kan därefter justeras separat.
Om lokal lagring inte är tillgänglig fungerar inställningarna för den aktuella
sessionen. Menyn visar då att de inte kunde sparas.

| Grafik | Skuggor | Bloom | Högsta pixelfaktor |
| --- | --- | --- | --- |
| Låg | Av | Av | 1,0 |
| Medel | 1024 px | Av | 1,25 |
| Hög | 2048 px | På | 1,8 |

Pixelfaktorn begränsas också av skärmens faktiska pixeltäthet. Aktivera
**Visa FPS och bildtider** för att se median och P95 för de senaste 240
bildrutorna. P95 är den bildtid som 95 procent av bildrutorna understiger.
Lägre bildtid ger jämnare flyt.

Efter en överlevd våg pausas striden tills du väljer en förstärkning:

- **Ammunition:** +20 M12, +90 AK5-C och +105 CAR-15 i reserv. Reserven kan som
  mest bli dubbelt så stor som startförrådet. Magasinen laddas med `R` som vanligt.
- **Sjukvård:** +35 hälsa, högst 100.
- **Skyddsväst:** +35 skydd, högst 50.

Du kan också fortsätta utan förstärkning. Bara ett val ges per vågpaus;
förstärkningar som redan är helt fyllda är inaktiva. Den tidigare vågbonusen
ges fortfarande en gång per överlevd våg.

Spelet kräver tangentbord, mus och en webbläsare med WebGL och muslåsning.

## Lokal utveckling

```bash
npm install
npm run dev
```

Produktionsbygge:

```bash
npm run build
npm run preview
```

Regressionstester (Node.js 20 eller senare):

```bash
npm test
```

Testerna kontrollerar bildfrekvensoberoende eldhastighet och klättring vid hinder,
omladdning, paus, omstart, nekad muslåsning, återanvändning och frigöring av
grafikresurser, inställningar, HUD-uppdateringar och förstärkningar mellan vågor.
De importerar produktionsmodulerna direkt utan att starta WebGL.

Webbläsarkontroller och en upprepningsbar belastningsmätning finns i
`tools/browser-checks.js` och `tools/browser-benchmark.js`. Köranvisningar och
uppmätta resultat finns i [docs/verification.md](docs/verification.md).

## Kodstruktur

| Modul | Ansvar |
| --- | --- |
| `main.js` | Start och CSS |
| `game.js` | Spelläge, input, strid och samordning |
| `config.js` | Vapen- och drönarvärden |
| `weapon-view.js` | Cachade vapenmodeller och animation |
| `drone.js` | Drönarmodell, styrning och hälsa |
| `world.js`, `collision.js` | Miljö, instanser och kollision |
| `effects.js` | Begränsade pooler för partiklar, spårljus och explosionsljus |
| `audio.js` | Ljudsyntes och separata volymbussar |
| `hud.js` | HUD, skadeindikator, radar och prestandavisning |
| `settings.js`, `performance.js`, `resupply.js` | Inställningar, mätvärden och vågval |

Projektet är byggt med Vite och Three.js och kan publiceras som en vanlig statisk webbplats.
