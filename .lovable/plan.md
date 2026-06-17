## Probleem
De website-header is visueel te groot. Het SVG-logo heeft een enorme viewBox (`0 0 1180 320`) met veel witruimte rondom de daadwerkelijke content. De achtergrond-rechthoek (`<rect fill="#F7F3EC" width="1180" height="320"/>`) vult de hele viewBox, waardoor het logo altijd als een grote blok verschijnt.

## Oplossing
1. **Download beide SVG-logo's** (light + dark variant) van de CDN
2. **Bewerk de SVG's**:
   - Verwijder de achtergrond-rechthoek (`<rect width="1180" height="320" fill="#F7F3EC"/>`)
   - Pas de `viewBox` aan naar strakkere bounds die dicht op de content zitten (~X: 0-800, Y: 55-240)
3. **Upload bewerkte SVG's als nieuwe assets** via `lovable-assets create`
4. **Update de `.asset.json` pointer files** in `src/assets/`
5. **Herstel de oorspronkelijke logo-CSS** in `SiteLogo.tsx` (de `h-...` classes terugzetten naar hun oorspronkelijke waarden zodat het logo qua visuele grootte hetzelfde blijft)

## Wat er verandert
- Header wordt **~50% kleiner** doordat de SVG-witruimte is verwijderd
- Logo zelf (tekst "YEKETI", zonnetje, "MOTORWORKS") blijft **visueel identiek** qua grootte
- Geen aanpassingen aan navigatietekst, kleuren, of functionaliteit

## Bestanden
- `src/assets/yeketi-logo-horizontal-light.svg.asset.json`
- `src/assets/yeketi-logo-horizontal-dark.svg.asset.json`
- `src/components/SiteLogo.tsx` (eventueel CSS herstellen)