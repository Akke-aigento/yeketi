## Aanvragen-tab opkuisen

Vier kleine fixes, allemaal in het admin-aanvragen-paneel (`src/routes/_authenticated/admin/offertes.tsx`).

### 1. WhatsApp-link werkt niet
De huidige link bouwt `wa.me/0473406107`. WhatsApp accepteert geen lokale nummers met een leidende 0 — vandaar de "This link couldn't be opened"-popup. We normaliseren naar internationaal formaat:
- Begint met `+` → `+` strippen, rest gebruiken.
- Begint met `00` → vervangen door niets (al internationaal zonder `+`).
- Begint met `0` en alleen cijfers → leidende 0 strippen en `32` (België) voorzetten.
- Anders → cijfers gebruiken zoals ze zijn.

Resultaat voor `0473406107` → `https://wa.me/32473406107?text=…`. Werkt op iOS en desktop.

### 2. E-mail moet via in-app bericht, niet via persoonlijke mailbox
Het `mailto:`-knop opent Baram's mailbox en stuurt vanuit zijn privé-adres — onprofessioneel en buiten het portaal. Vervangen door een **"Stuur bericht"**-knop die naar de bestaande conversatie navigeert in `/admin/berichten/$id`.

Achtergrond: bij een form-submission roept de site al `linkQuoteRequestToConversation` aan, die stil een profiel + conversatie aanmaakt voor het e-mailadres. Die conversatie bestaat dus al.

Implementatie:
- Nieuwe kleine server-fn `getConversationForQuoteRequest({ quoteRequestId })` in `src/lib/messages.functions.ts` die het profiel/de conversatie voor het e-mailadres ophaalt — en aanmaakt als die er nog niet zou zijn (defensief, voor oude aanvragen van vóór de hook).
- In de aanvraagkaart: de huidige `mailto:`-knop wordt **"Stuur bericht in portaal"**. Klikken → server-fn roepen, dan `navigate({ to: "/admin/berichten/$id", params: { id: convId } })`.
- Het e-mailadres blijft zichtbaar als kleine label-tekst (zodat Baram dat nog kan zien/kopiëren), maar zonder klikbare `mailto:`.

### 3. Foto's laden niet + geen kruisje om te sluiten
De bucket `quote-photos` is privé (admin-read RLS). De code rendert nu rechtstreeks `<img src={path}>` zonder signed URL → vandaar de blauwe vraagteken-placeholder. Boven op het openen via `target="_blank"` is er geen in-app sluitknop.

Fix:
- Wanneer een kaart wordt opengeklapt en `foto_urls.length > 0` is, één keer signed URLs ophalen via `supabase.storage.from("quote-photos").createSignedUrls(paths, 3600)` (zelfde patroon als `projecten.$id.tsx`). Resultaat cachen in state per `quote.id`.
- Thumbnails renderen met de signed URL.
- Klik op een thumbnail opent een **in-app lightbox** (vaste modal): donkere overlay (`background: rgba(0,0,0,0.85)`), grote afbeelding gecentreerd, een duidelijk **×-kruisje** rechtsboven (`aria-label="Sluit"`), en klik op de overlay buiten de afbeelding sluit ook. Escape-toets ondersteunt sluiten. Respecteert `prefers-reduced-motion`.

### 4. "Maak project + nodig klant uit" — klant bestaat al
De knop suggereert dat de klant nog aangemaakt moet worden, maar het profiel + de conversatie bestaan al sinds de formulier-submission. Wat er wél nog gebeurt is: (a) een **project** aanmaken met standaardfasen, en (b) de eerste echte **portaaluitnodigingsmail** versturen zodat de klant kan inloggen.

Geen wijziging aan de business-logica van `convertQuoteToProject` — alleen de UI verduidelijken:
- Knoplabel wordt **"Maak project & verstuur portaaluitnodiging"**.
- De bevestigingstekst wordt aangepast: "De klant heeft al een profiel uit de aanvraag. We maken nu een project aan voor `${naam}` en sturen de eerste portaaluitnodiging naar `${email}`." (i.p.v. de huidige "uitnodigingsmail sturen"-formulering).
- Toast na succes: "Project aangemaakt en portaaluitnodiging verstuurd."

### Technische details

| Bestand | Wijziging |
|---|---|
| `src/routes/_authenticated/admin/offertes.tsx` | `waLink` herschrijven (BE-normalisatie); `mailto:` vervangen door portaalknop met server-fn-call + navigatie; signed-URL state + in-app lightbox-modal; knoplabels en bevestigings-/toasttekst aanpassen. |
| `src/lib/messages.functions.ts` | Nieuwe `getConversationForQuoteRequest` server-fn (admin-only): zoekt op e-mail het profiel, `ensureConversation(...)` zo nodig, retourneert `{ conversationId }`. |

Buiten scope: e-mail-templates, RLS, storage-policies, business-logica van `convertQuoteToProject`. Alleen kleine UX-/copy-/normalisatiewijzigingen.