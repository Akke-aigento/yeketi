
## Probleem

In de "Nieuwe update"-popup (admin → projecten → + Nieuwe update) lijkt de foto-selectie te verdwijnen: je kiest foto's in Finder/galerij, gaat terug naar de popup, maar er verschijnt niks. Sluit je daarna, dan is de tekst wel opgeslagen, maar zonder foto's.

In de code _bestaat_ wel een thumbnail-grid (regels ~836-875 van `src/routes/_authenticated/admin/projecten.$id.tsx`), maar in de praktijk zie jij die niet. Dat duidt op een bug — geen ontwerpkeuze.

## Vermoedelijke oorzaken (te bevestigen door reproductie)

1. **Object-URL lekt / wordt geblokkeerd**: `URL.createObjectURL(it.file)` wordt nu bij elke render opnieuw aangemaakt zonder ooit `revokeObjectURL`. Op sommige browsers (vooral mobiel Safari) kan dat tot lege previews leiden of memory-druk.
2. **State-reset door re-render van de parent**: de popup is gemount als child van `ProjectDetail`. Een refetch/re-render tussen het openen van de file-picker en terugkeren kan de modal onbedoeld opnieuw mounten waardoor `items` leeg wordt.
3. **Click-bubbling op de `<label>`**: de Camera/Galerij-knoppen zijn `<label>` met geneste `<input>` — op sommige browsers vuurt dat de change-handler dubbel of helemaal niet als er pointer-events op een ouder zitten.

## Plan

### 1. Reproduceren + root cause vastleggen
- Inspecteren met devtools wat er gebeurt na file-selectie: vuurt `onChange`? Komt `addFiles` binnen? Krijgt `items` waarde maar verdwijnt die direct weer?
- Op basis daarvan kies ik de juiste fix (één van de drie hierboven of een combinatie).

### 2. Stabiele preview-URL's per file
- Object-URL per `FileItem` één keer aanmaken (bij `addFiles`) en bewaren in state, niet in render.
- `URL.revokeObjectURL` aanroepen bij verwijderen en bij unmount van de modal.

### 3. Modal-state beschermen tegen parent re-renders
- Indien nodig: de modal als top-level portal renderen of de items via `useRef` parallel houden, zodat een achtergrond-refetch de selectie nooit kan wegvegen.

### 4. UX zoals jij vroeg
- Thumbnails blijven zichtbaar zodra je ze hebt gekozen, ook vóór "Publiceer update".
- Per thumbnail een ✕-knop om te verwijderen (zit er nu al, maar werkt alleen vóór publish — blijft zo).
- "+ Meer foto's toevoegen"-knop blijft beschikbaar zolang de modal open is, ook nádat de update gepubliceerd is — zo kun je in dezelfde flow extra foto's bijplaatsen zonder eerst de modal te sluiten en naar de projectpagina te gaan.
- Duidelijke status per thumbnail: _wacht / bezig / ok / fout_ (al aanwezig, blijft).

### 5. Verifiëren
- Met Playwright in headless Chromium op viewport 390×707 een file-selectie simuleren in deze popup en screenshotten dat de thumbnail meteen verschijnt + verwijderbaar is + dat publish met foto's werkt.
- Daarna handmatig door jou te bevestigen op iPhone én desktop.

## Bestanden die ik zal aanraken

- `src/routes/_authenticated/admin/projecten.$id.tsx` — `NewUpdateModal` (alleen die component, geen wijzigingen aan business-logica buiten upload-flow).

## Wat ik niet aanraak

- De projectpagina-flow voor foto's toevoegen aan een bestaande update (die werkt volgens jou correct).
- De storage-bucket, RLS of databasekolommen.
