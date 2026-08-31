# FPV Down

En modern förstapersonsbaserad 3D-försvarssimulator för webbläsaren. Spelaren försvarar en framskjuten position mot vågor av inkommande FPV-drönare med hagelgevär och automatkarbiner.

## Spelfunktioner

- Musstyrt förstapersonssikte och WASD-förflyttning med sprint.
- Tre vapen: M12 hagelgevär, AK5-C och CAR-15.
- Magasin, reservammunition, eldhastighet, spridning, rekyl och omladdning per vapen.
- Tre drönarklasser med olika hälsa, fart och skadeverkan.
- Dynamiska vågor, poäng, träffsäkerhet, rustning och slutrapport.
- Passiv radar, modern taktisk HUD och träffmarkeringar.
- Three.js/WebGL med ACES-tonemapping, mjuka skuggor, dimma, bloom och PBR-material.
- Realistisk, projektbunden terrängtextur framtagen särskilt för spelet.
- Syntetiserade skott-, träff-, omladdnings-, rotor- och explosionsljud via Web Audio API.

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

Projektet är byggt med Vite och Three.js och kan publiceras som en vanlig statisk webbplats.
