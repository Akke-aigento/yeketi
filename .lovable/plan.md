## Layoutcontrole — bevindingen

Ik heb beide kanten gescreenshot op desktop (1280px) én mobiel (390px). Onderstaande problemen verklaren waarom er dingen "weggedrukt" worden.

### 1. PortalHeader (klantportaal) — KRITIEK op mobiel
- **`UITLOGGEN`-knop valt buiten het scherm** op mobiel. De header is één enkele `flex` met `gap-5` en zonder wrap; te veel items (Admin · Jouw Restauraties · Berichten · Uitloggen) passen niet naast de logo.
- **Logo rendert als brede alt-tekst** ("Yeketi Motorworks" over twee regels) omdat `<SiteLogo />` geen breedte-cap heeft binnen deze header.
- Geen `min-w-0` op de logo-container → drukt de rechterkant nog verder eruit.

### 2. AdminShell (admin top-nav) — KRITIEK op mobiel
- De tabbalk gebruikt `overflow-x-auto`, maar zonder zichtbare scroll-affordance: **`RECENT WERK`, `AANVRAGEN`, `OFFERTES`, `KLANTEN`, `INSTELLINGEN` zijn op mobiel volledig verborgen** achter de rechterrand. Dit is letterlijk het "wegdrukken" dat je zag.
- Top-rij (e-mail · ← Site · Uitloggen) is krap maar past; e-mail wordt al verborgen <sm.

### 3. `/portaal/berichten` invoer
- Op mobiel staat de **`VERSTUUR`-knop náást** een smal textarea (button neemt ~40% breedte). Hoort onder elkaar op mobiel.

### 4. `/admin/klanten` rij-acties
- "Bericht sturen / Bewerken / Stuur link" stapelen verticaal rechts in de rij → 3 regels naast de naam. Op mobiel even rommelig.

### 5. CookieBanner
- Banner is Engelstalig ("We only use functional cookies… GOT IT / Read more") terwijl de rest Nederlands is. Op mobiel dekt hij ~25% van het scherm tot je hem wegklikt.

### 6. Klein
- Op `/portaal` wrapt de offerte-eyebrow ("YEK-2026-001 · WACHT OP ANTWOORD") in twee regels op mobiel — acceptabel maar kan strakker.

---

## Voorgestelde fixes (alleen UI, geen logica/RLS/quotes)

### A. `src/components/PortalHeader.tsx`
- Header omzetten naar `grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:justify-between` zodat logo + acties altijd op één rij blijven én niet clippen.
- `SiteLogo` cappen met `max-w-[160px] sm:max-w-[200px]` container + `shrink-0`.
- Secundaire links (Admin · Jouw Restauraties · Berichten) op `< sm` verplaatsen naar een tweede rij eronder, `flex gap-4 overflow-x-auto`. Uitloggen blijft altijd zichtbaar rechtsboven.
- Kleinere `gap`/typografie (`text-[11px]`) op mobiel.

### B. `src/components/AdminShell.tsx`
- Tabs-rij: behouden `overflow-x-auto` maar toevoegen van rechter "fade" (mask-image gradient) zodat duidelijk is dat er meer is.
- Optioneel: op `< sm` automatisch horizontaal scrollen naar actieve tab via `scrollIntoView({ inline: "center" })`, zodat de huidige sectie altijd zichtbaar start.
- Top-rij: `min-w-0` + `truncate` op e-mail; `shrink-0` op Site/Uitloggen.

### C. `src/routes/_authenticated/portaal.berichten.tsx`
- Compose-blok: `flex flex-col sm:flex-row sm:items-end gap-3`. Knop wordt full-width op mobiel, naast tekstvak op desktop. Textarea min `min-h-[7rem]` op mobiel.

### D. `src/routes/_authenticated/admin/klanten.tsx`
- Rij-actions in een eigen `flex flex-wrap gap-x-4 gap-y-1 justify-end` met `text-[11px]`, of stapelen onder de naam op `< sm`. Voeg `min-w-0 truncate` toe aan naam/e-mail.

### E. `src/components/CookieBanner.tsx`
- Nederlandstalige copy: "We gebruiken alleen functionele cookies — nodig om in te loggen op het klantportaal. Geen tracking, geen advertenties." · knop "Oké" · link "Meer lezen".
- Mobiel compacter: kleinere padding, twee regels max.

### F. `src/routes/_authenticated/portaal.index.tsx` (klein)
- Offerte-eyebrow: `text-[10px]` op mobiel + `truncate` op de titel, zodat de rij niet wrapt.

---

## Wat ik NIET aanraak
- Quote-systeem, RLS, auth, server functions, e-mail-flows, data-modellen.
- Inhoud/structuur van pagina's. Alleen layout/typografie/responsive gedrag.

Na akkoord rapporteer ik per bestand wat er gewijzigd is en zet ik opnieuw mobiel- en desktop-screenshots ernaast.