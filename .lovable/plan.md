## Analyse — wat werkt, wat niet

### 1. Afzender van mails (jouw grootste pijnpunt)
- **Supabase auth-mails** (invite + wachtwoord reset) gaan nu via het default Supabase-mailsysteem. Afzender = iets als `noreply@mail.app.supabase.io`. Geen Yeketi branding, vaak in spam.
- **Resend-mails** (offerte naar admin + fase-updates naar klant) gaan via `notify-events`. `FROM_EMAIL` secret is gezet, maar als fallback staat `onboarding@resend.dev` — als de secret niet exact klopt, krijg je dat lelijke testadres.
- Er is **wél** een geverifieerd e-maildomein in de workspace (`sellqo.app`) maar dat hoort bij een ander project — niet bij Yeketi. Voor een propere afzender `noreply@yeketimotorworks.com` (of `mail@…`) moet er een Yeketi-subdomein geverifieerd worden, en moeten daarna de auth-mailtemplates gescaffold worden zodat invites/resets via jouw domein + jouw branding gaan.

### 2. Invite/reset flow — functioneel
- Invite stuurt naar `/reset-password` met `type=invite` in de hash. Reset-page detecteert dat en past de titel aan. ✅ werkt sinds vorige fix.
- Maar `redirectTo` gebruikt `process.env.PUBLIC_SITE_URL`. Als die secret ooit naar de preview-URL wijst, komen klanten in preview-omgeving terecht in plaats van productie.
- `resendInvite` faalt hard als de gebruiker al bestaat én bevestigd is. Geen nette melding in de UI.
- `listUsers({ page: 1, perPage: 200 })` is een tijdbom: zodra er >200 users zijn, wordt een bestaande klant niet meer gevonden en wordt er opnieuw uitgenodigd / faalt het.
- Geen check op `email_confirmed_at` bij convert-quote — als iemand ooit een aanvraag deed en nu reageert, krijgt hij geen nieuwe invite-link.

### 3. Login / reset-password UX
- `/login`: bij "wachtwoord vergeten" zie je geen onderscheid tussen "mail verstuurd" en "mailadres bestaat niet" (Supabase verbergt dit bewust, prima — maar copy mag duidelijker).
- `/reset-password`:
  - Als de hash ongeldig/verlopen is en er is **geen** sessie, blijft het formulier zichtbaar maar disabled met "Recovery-link wordt geverifieerd…" — dat hangt voor altijd. Beter: na ~3s timeout → tonen "link ongeldig, vraag een nieuwe aan".
  - Geen "wachtwoord tonen" toggle, geen sterkte-indicator.
  - Bij invite staat er `Welkom — stel je wachtwoord in` maar geen vermelding van het e-mailadres waarvoor je het wachtwoord zet. Verwarrend als iemand meerdere adressen heeft.
- Login-page heeft geen "wachtwoord tonen" en de "wachtwoord vergeten"-link staat onder de submit-knop — gebruikelijker is naast het wachtwoordveld.

### 4. Mail-template (Resend, fase-updates en offerte naar admin)
- Template ziet er goed uit (cream/charcoal/brass), maar:
  - Geen plain-text fallback → slechtere deliverability + spam score hoger.
  - Geen `Reply-To` header → klant kan niet zomaar antwoorden op een update.
  - Geen unsubscribe / footer met fysiek adres → minder pro, hogere spam-kans.
  - Logo ontbreekt visueel (alleen tekst-eyebrow).

### 5. Overige observaties
- Geen welkomstmail nadat invite-gebruiker zijn wachtwoord heeft gezet ("je portaal is klaar, bekijk je project").
- Geen rate-limit-melding bij te veel reset-pogingen (Supabase geeft 429 → je toont generieke "iets ging mis").
- Geen e-mail aan de klant bij `convertQuoteToProject` met uitleg "je hebt nu een portaal".

---

## Verbeterplan (volgorde van impact)

### Stap 1 — Yeketi-domein voor mail opzetten (grootste win voor afzender)
Setup-dialog tonen voor een Yeketi-subdomein (bv. `mail.yeketimotorworks.com`). Na verificatie:
- `scaffold_auth_email_templates` → invite-, recovery-, magic-link- en e-mail-change-templates in Yeketi-stijl (zelfde cream/charcoal/brass als `notify-events`).
- Afzender invites/resets wordt `Yeketi Motorworks <noreply@mail.yeketimotorworks.com>`.
- `FROM_EMAIL` secret updaten naar hetzelfde adres zodat fase-update- en admin-mails dezelfde afzender krijgen.
- `Reply-To` toevoegen aan Resend-calls met `info@yeketimotorworks.com` (of door jou gekozen adres).

### Stap 2 — Invite/reset robuuster maken (`src/lib/admin.functions.ts`)
- Vervang `listUsers({ perPage: 200 })` door `getUserByEmail` (admin API) zodat het schaalbaar is.
- Detecteer bestaande, al-bevestigde gebruikers en stuur dan een **password reset** in plaats van een nieuwe invite (anders krijgt klant "invite already accepted"-error).
- `redirectTo` hardcoderen op publieke productie-URL (`https://yeketimotorworks.com/reset-password`) i.p.v. env-var die kan afwijken.

### Stap 3 — `/reset-password` polijsten
- Timeout van 4s op "Recovery-link wordt geverifieerd…" → toon dan `linkError` flow met "vraag nieuwe link aan".
- Toon het e-mailadres van de sessie bovenaan ("Je stelt een wachtwoord in voor: `klant@example.com`").
- Wachtwoord-tonen toggle + minimale sterkte-indicator (≥8 tekens, gemixt).
- Bij invite: na opslaan → redirect direct naar `/portaal` (al zo) + één toast "Welkom, je portaal staat klaar".

### Stap 4 — `/login` polijsten
- "Wachtwoord vergeten?" link verplaatsen onder het wachtwoordveld (rechts uitgelijnd).
- Wachtwoord-tonen toggle.
- Bij `forgot`-flow: copy duidelijker ("Als dit adres bekend is, ontvang je binnen enkele minuten een link.").
- 429-detectie → "Je hebt al een link opgevraagd, controleer je mailbox of probeer over een paar minuten opnieuw."

### Stap 5 — Mail-template upgraden (`notify-events`)
- Plain-text variant meesturen (`text:` veld in Resend payload).
- `reply_to` toevoegen.
- Footer uitbreiden met fysiek adres + één-regelige uitleg "Je ontvangt deze mail omdat je een lopend project hebt bij Yeketi Motorworks."
- Inline Yeketi-logo (kleine PNG/CID of een gehoste URL) boven de eyebrow.

### Stap 6 — Welkomstmail na eerste wachtwoord
- Na succesvolle `updateUser({ password })` bij `type=invite`: server-fn die één welkomstmail stuurt met directe link naar het portaal.

---

## Wat ik nodig heb van jou voor we beginnen
1. **Welk subdomein** wil je voor mail? Voorstel: `mail.yeketimotorworks.com` (afzender wordt dan `noreply@mail.yeketimotorworks.com`).
2. **Reply-to adres** dat klanten mogen mailen (bv. `info@yeketimotorworks.com` of `baraam@…`).
3. **Akkoord op volgorde**: start ik met stap 1 (domein-setup, grootste impact op afzender) of wil je liever eerst stap 2+3 (flow robuuster) en daarna mail-branding?
