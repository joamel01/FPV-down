# Verifiering och prestanda

Kontrollerat lokalt 2026-09-06 i Chromium via agent-browser.

## Kontroller

- 24 automatiserade Node-tester mot produktionsmodulerna passerade.
- 13 kompletterande kontroller i den renderade webbläsarversionen passerade:
  ljudstart, inställningsformulär, lokal lagring, grafikkvalitet, separata
  ljudbussar, omladdning efter vapenbyte, omladdningsanimation, ammunitionsvarning,
  skadeindikator, vågbonus och förstärkningsmeny, val av skyddsväst, skydd mot
  dubbla val samt stabilt antal geometribuffertar vid upprepade effekter.
- Startknappen gav fungerande muslåsning och ett aktivt AudioContext.
- Medelgrafik, muskänslighet 1,75, inverterat sikte, huvudvolym 50 %, effekter
  35 %, rotorljud 20 % och prestandavisning återställdes efter sidomladdning.
- Produktionsbygget passerade. Vite ger fortfarande en varning för storleken
  på JavaScript-paketet som innehåller Three.js; det är inget byggfel.

## Belastningsmätning

1258 × 622 CSS-pixlar, pixelfaktor 1, 24 samtidigt aktiva drönare.
60 bildrutor för uppvärmning följdes av 180 uppmätta bildrutor per läge.
Alla 24 drönare var kvar vid slutet av varje mätning. Ritanrop räknades över
hela bildrutan, inklusive skuggor och efterbehandling.

| Version/läge | Median bildtid | P95 | Ritanrop/bildruta | Geometribuffertar |
| --- | ---: | ---: | ---: | ---: |
| Referens före ombyggnaden, hög | 16,7 ms | 16,7 ms | 913 | 487 |
| Ny version, hög | 16,7 ms | 16,8 ms | 483 | 171 |
| Ny version, medel | 16,7 ms | 16,8 ms | 470 | 171 |
| Ny version, låg | 16,7 ms | 16,8 ms | 181 | 99 |

Mätningen låg nära 60 FPS även före ändringarna. Den visar därför färre
ritanrop och geometribuffertar, men inte en uppmätt FPS-förbättring på denna
dator. Referenskörningen använde slumpmässiga drönarplaceringar; de tre nya
lägena använder samma startfrö. Jämförelsen är samma belastningsklass och
kameraläge, inte en identisk uppspelning bildruta för bildruta. Pixelfaktorernas
effekt på tätare skärmar ingår inte i denna mätning.

Ett separat återanvändningstest värmde upp alla tre vapen och en explosion.
Efter 20 ytterligare vapenbyten och explosioner var antalet geometribuffertar
oförändrat på 119. Detta är ett annat scenario än 24-drönartestet ovan.

Effektpoolerna tillåter högst 256 partiklar, 24 spårljus och 6 explosionsljus.
Om poolerna blir fulla utelämnas extra visuella effekter. Skada, poäng och
kollision påverkas inte. Omstart tömmer aktiva effekter till poolerna;
`dispose()` frigör resurserna när hela systemet tas bort.

## Upprepa kontrollerna

Starta en separat lokal testserver:

```powershell
npm run dev -- --port 4186 --strictPort
```

I en annan terminal:

```powershell
npm test
npm run build
npx agent-browser --session fpv-review open http://127.0.0.1:4186/
npx agent-browser --session fpv-review snapshot -i
```

Klicka på Start med aktuell referens från snapshoten (citera `@eN` i
PowerShell). Kör därefter:

```powershell
Get-Content -Raw tools/browser-checks.js | npx agent-browser --session fpv-review eval --stdin
```

Kontrollerna skapar egna testsituationer i spelomgången och ändrar den
isolerade testprofilens inställningar. Ladda om sidan för att kontrollera att
inställningarna kommer tillbaka. Kör sedan på en ny sidladdning:

```powershell
Get-Content -Raw tools/browser-benchmark.js | npx agent-browser --session fpv-review eval --stdin
npx agent-browser --session fpv-review close
```

Node-testerna kräver Node.js 20 eller senare. Browserverktygets egna
runtimekrav styrs av den installerade versionen.

## Fortsatt speltestning

Förstärkningarnas värden är en första balansinställning. Långvariga spelsessioner
behövs för att avgöra om ammunition, hälsa och skydd blir jämnt användbara
alternativ i senare vågor. Resultaten ovan är tekniska kontroller, inte en
fullständig balans- eller hårdvarustudie.
