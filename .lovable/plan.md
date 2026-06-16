## Probleem

Vandaag bestaan er twee parallelle wereldjes onder dezelfde tab:

- **Aanvragen** (`quote_requests`, statussen: nieuw → contact → quoted → won/lost)
- **Documenten** (`quotes`, statussen: concept → verstuurd → akkoord → afgewezen)

Twee lijsten, twee statussen, twee filtersets, twee "akkoord"-momenten. Een aanvraag waarop een offerte gemaakt wordt, leeft daarna op twee plekken. Resultaat: jij weet zelf niet meer waar je een lead moet zoeken.

## Visie: één pipeline, één lijst, één detailpagina

We mappen alles op één funnel die de werkelijke realiteit volgt:

```text
Nieuw  →  In gesprek  →  Offerte open  →  Akkoord  →  Project
                                   ↘  Verloren
```

- **Eén lijst** (`/admin/aanvragen`) met alle leads, gesorteerd & filterbaar op die zes fases.
- **Eén detailpagina** (`/admin/aanvragen/$id`) waar bovenaan de aanvraag staat (klant, voertuig, foto's, beschrijving, contactknoppen) en daaronder — op dezelfde pagina — de offerte‑editor (regels, totaal, intro, verzendknop, klantreactie). Geen tab-switch meer.
- **Documenten‑tab verdwijnt.** Een offerte is niet langer een "ander ding"; het is gewoon een attribuut van de aanvraag. De `quotes`‑tabel blijft bestaan (geen schemamigratie), maar de UI behandelt 'm als deelobject van de aanvraagkaart.

De fase van een lead wordt **afgeleid**, niet handmatig dubbel bijgehouden:

| Pipeline-fase | Afgeleid van |
|---|---|
| Nieuw | `quote_requests.status = 'new'` en geen quote |
| In gesprek | `quote_requests.status = 'contacted'` en geen quote |
| Offerte open | er bestaat een quote met status `concept` of `verstuurd` |
| Akkoord | er bestaat een quote met status `akkoord` (of `quote_requests.status = 'won'` zonder offerte) |
| Project | aanvraag is omgezet naar project |
| Verloren | `quote_requests.status = 'lost'` óf alle quotes `afgewezen` |

Jij hoeft dus nooit meer twee statussen synchroon te houden — je werkt aan de aanvraag, en de fase volgt automatisch wat er gebeurt.

## Hoe ziet het eruit

### Lijst `/admin/aanvragen`
- Bovenaan: zes fase‑chips als filter (Nieuw · In gesprek · Offerte · Akkoord · Project · Verloren) met telling per fase en een rode badge op "Nieuw".
- "Alles" + zoekveld (naam/voertuig/e-mail).
- Lijstkaart per lead: naam, voertuig, fase‑badge, leeftijd, en — als er een offerte aan hangt — het offertenummer + bedrag rechts. Eén tap → detail.
- Eén primaire knop bovenaan: **"+ Snelle offerte"** (de huidige `createBlankQuote` flow, maar je moet eerst een klant kiezen of een mini‑aanvraag invullen — zo blijft alles in de pipeline en verschijnen er geen "wees‑offertes" meer in een aparte lijst).

### Detail `/admin/aanvragen/$id`
Drie collapsible secties, in volgorde van workflow:

1. **Lead** — klantgegevens, voertuig, beschrijving, foto's (lightbox), WhatsApp/bel/portaalbericht‑knoppen.
2. **Offerte** —
   - als er nog geen offerte is: één knop "Offerte opmaken" → maakt blanco quote + scrolt naar de editor in dezelfde sectie.
   - als er wel een offerte is: inline editor (titel, voertuig, intro, regels, totaal, notities, "Verstuur"/"Markeer als verstuurd"). Statusbadge bovenaan deze sectie.
   - klantreactie (akkoord/afwijzing + reden) verschijnt hier als die binnenkomt.
3. **Project** — verschijnt zodra fase = Akkoord (of als jij 'm forceert). Eén knop "Maak project aan" (de bestaande flow, klant is al uitgenodigd dankzij de vorige ronde). Eens omgezet: link naar het project + label "Project aangemaakt op …".

Onderaan: Verloren markeren / Aanvraag verwijderen (rood, secundair).

### Navigatie
- Top‑nav‑tab heet voortaan **"Aanvragen"** (niet meer "Offertes"). Eén knop, één lijst.
- `OffertesTabs.tsx` (sub‑tabs Aanvragen/Documenten) wordt verwijderd.
- `/admin/quotes` en `/admin/quotes/$id` blijven bestaan als redirects naar respectievelijk `/admin/aanvragen` en `/admin/aanvragen/$id?focus=offerte`, zodat oude bookmarks en e‑maillinks niet breken.

## Technische impact

Geen schema‑ of RLS‑wijzigingen. Alles is UI‑herstructurering + één afgeleide helper.

- **Nieuw**: `src/lib/pipeline.ts` — pure functie `derivePhase(request, quotes, projectId)` die de pipeline‑fase bepaalt; ook gebruikt voor de chip‑tellingen.
- **Nieuwe route**: `src/routes/_authenticated/admin/aanvragen.index.tsx` (lijst met fase‑chips, zoek, kaarten).
- **Nieuwe route**: `src/routes/_authenticated/admin/aanvragen.$id.tsx` (detail met de drie secties + ingebouwde offerte‑editor; herbruikt het bestaande UI uit `quotes.$id.tsx`).
- **Vervangen**:
  - `src/routes/_authenticated/admin/offertes.tsx` → dunne redirect naar `/admin/aanvragen`.
  - `src/routes/_authenticated/admin/quotes.index.tsx` → redirect naar `/admin/aanvragen`.
  - `src/routes/_authenticated/admin/quotes.$id.tsx` → redirect naar `/admin/aanvragen/$id` met focus op offertesectie (of, simpeler, blijft bestaan maar wordt enkel intern bereikt via de detailpagina‑embed; te beslissen in implementatie).
- **Aangepast**:
  - `src/components/AdminShell.tsx` — tablabel "Offertes" → "Aanvragen", `activePrefixes` aanpassen, route‑type bijwerken.
  - `src/components/OffertesTabs.tsx` — verwijderen.
  - `src/hooks/useAdminUnreadCounts.ts` — `requests`‑teller blijft (= aantal in fase "Nieuw"); badge zit nu op de hoofdnavigatie i.p.v. op een sub‑tab.
  - `src/lib/quotes.functions.ts` — `createBlankQuote` vraagt voortaan optioneel een `quoteRequestId` of `customerId` zodat losse offertes ook in de pipeline landen. `createQuoteFromRequest` blijft, wordt direct vanuit de detailpagina aangeroepen.

## Wat dit oplost

- Eén plek om naar te kijken, geen tab‑switch tussen "Aanvragen" en "Documenten".
- Geen dubbele statussen meer om bij te houden — de fase volgt automatisch uit wat je doet (offerte versturen, klant akkoord, project aanmaken).
- Snel‑offerte‑zonder‑aanvraag verdwijnt niet meer in een aparte lijst, maar leeft in dezelfde pipeline.
- Het bestaande domeinmodel (`quote_requests` + `quotes`) blijft intact — geen risico op data‑verlies of migratiepijn.

## Wat dit niet doet

- Geen wijziging aan de publieke offerte‑formulieren, klantenportaal, e‑mailtemplates of RLS.
- Geen schemamigraties.
- Geen wijziging aan projecten/berichten/recent-werk.
