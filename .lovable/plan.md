## Doel

Aanvraagflow gelijktrekken met contactform: bij het versturen van een offerte­aanvraag krijgt de klant meteen een portaaluitnodiging. De adminknop wordt weer simpelweg **"Maak project aan"**.

## Waarom

Vandaag stuurt `submitContactForm` automatisch een invite (silent profiel + e-mail), maar `linkQuoteRequestToConversation` zet bewust `skipInvite: true` ("Baram contacteert ze persoonlijk"). Daardoor moest de adminknop een dubbele actie doen (project + uitnodiging). De klant heeft het formulier zelf ingevuld, dus een directe portaaluitnodiging is verwacht gedrag — net als bij contact.

## Wijzigingen

### 1. `src/lib/messages.functions.ts` — `linkQuoteRequestToConversation`
- `findOrInviteUser(email, naam, { locale })` zonder `skipInvite`, zodat een nieuwe lead direct een invite-mail ontvangt (bestaande profielen worden niet opnieuw gemaild — dat zit al in `findOrInviteUser`).
- Comment bijwerken.

### 2. `src/lib/admin.functions.ts` — `convertQuoteToProject`
- Geen `inviteOrReset` meer (anders krijgt de klant bij projectaanmaak nóg een reset-mail). 
- Profiel opzoeken via e-mail (bestaat altijd dankzij stap 1 / DB-trigger). Als het er onverwacht niet is, fallback: `findOrInviteUser` met `skipInvite: true` om enkel te garanderen dat er een profiel is, zonder mail. 
- Verder ongewijzigd: profiel-upsert (naam/telefoon), project + phases aanmaken, `quote_requests.status = 'won'`.
- Retourneert nog steeds `{ projectId }`.

### 3. `src/routes/_authenticated/admin/offertes.tsx`
- Knoplabel terug naar **"Maak project aan"**.
- Bevestigingstekst: korte uitleg dat de klant al uitgenodigd is bij de aanvraag en dat dit enkel het project aanmaakt.
- Toastbericht: "Project aangemaakt".

## Wat blijft

- Geen RLS- of schemawijzigingen.
- E-mailtemplates (`InviteEmail` / `AdminInviteEmail`) onaangeroerd.
- WhatsApp-link, in-app berichtknop, signed photo URLs en lightbox uit de vorige ronde blijven staan.
- Bestaande aanvragen die al een profiel hebben krijgen geen extra mail (idempotent via `findOrInviteUser`).
