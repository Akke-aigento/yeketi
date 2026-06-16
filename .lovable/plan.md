
## Doel

De default Supabase-auth-mails (afzender "Yeketi-Motorworks-Legacy", kale dark
template) vervangen door dezelfde brandstijl als de admin→klant mails, én ze
laten vertrekken vanaf `info@yeketimotorworks.com` — exact dezelfde afzender
en pipeline (Resend) als de mooie transactionele mails die nu al werken.

## Aanpak

Lovable's eigen auth-mail-scaffolding gebruikt **niet** `info@yeketimotorworks.com` — die zou een afzender op een gedelegeerde subdomeinen vereisen (bv. `notify@notify.yeketimotorworks.com`), DNS-NS-records bij Yeketi's domein nodig hebben, en kan conflicteren met de bestaande Resend-setup. Daarom gaan we de andere route:

**Supabase Auth → "Send Email Hook" (webhook) → onze eigen edge function → Resend.**

Hetzelfde patroon als nu voor `notify-events`, met dezelfde shared
`email-template.ts` zodat de mails er identiek uitzien.

## Stappen

### 1. Nieuwe edge function: `supabase/functions/auth-email/index.ts`

- Endpoint dat Supabase Auth aanroept bij elke auth-actie (`signup`,
  `recovery`, `magiclink`, `invite`, `email_change`, `reauthentication`).
- Verifieert de "Standard Webhook"-signature (Supabase tekent met een
  Auth-hook secret — nieuwe Supabase secret `AUTH_EMAIL_HOOK_SECRET`).
- Bouwt de juiste link met de meegestuurde token-hash + redirect URL.
- Rendert via bestaande `_shared/email-template.ts` met locale-aware copy
  uit `_shared/email-copy.ts`.
- Verstuurt via Resend met `from: "Yeketi Motorworks <info@yeketimotorworks.com>"`
  (zelfde als bestaande mails).
- Logt fouten in `notify_event_failures` zoals nu.

### 2. Mail-copy uitbreiden — `supabase/functions/_shared/email-copy.ts`
en `src/lib/email-copy.server.ts`

Nieuwe NL+EN secties voor de 6 auth-types:
- `auth_signup` — "Bevestig je e-mailadres" / "Confirm your email"
- `auth_recovery` — "Stel je wachtwoord opnieuw in" / "Reset your password"
- `auth_magic_link` — "Log in op je portaal" / "Sign in to your portal"
- `auth_invite` — "Welkom bij Yeketi Motorworks" / "Welcome…"
- `auth_email_change` — "Bevestig je nieuwe e-mailadres"
- `auth_reauthentication` — "Bevestig je identiteit"

Elke variant: eyebrow, headline (serif), korte intro, CTA-label, helper-tekst
("link 1 uur geldig"), veiligheidsnotitie ("als jij dit niet was, negeer
deze mail").

### 3. Locale bepalen

Bij signup is er geen profiel; we lezen `user.user_metadata.locale` als de
client die meestuurt, anders fallback `nl`. Voor recovery/magic link/invite
zoeken we de bestaande `profiles.locale` op via service-role lookup op
`user.email`.

### 4. Supabase config

- Nieuwe secret `AUTH_EMAIL_HOOK_SECRET` aanmaken (gegenereerd).
- `supabase/config.toml` aanpassen: edge function registreren en
  `[auth.hook.send_email]` activeren met de webhook-URL + secret.
- Auth-hook URL: `https://<project>.supabase.co/functions/v1/auth-email`.

### 5. Login flow

`src/routes/login.tsx` aanpassen: bij `signUp`/`resetPasswordForEmail` de
gekozen locale meesturen in `options.data` zodat de hook ze ziet (anders
fallback via profiel-lookup).

## Wat NIET aangepast wordt

- De bestaande `notify-events` pipeline, RLS, business logic, of
  Supabase Auth zelf (geen wijziging aan wachtwoord-regels, geen
  auto-confirm).
- `info@yeketimotorworks.com` blijft de enige afzender — geen tweede sender,
  geen nieuwe DNS, geen Lovable Emails domain setup.
- De huidige Lovable-auth-mail-scaffolding (`scaffold_auth_email_templates`)
  wordt **niet** gebruikt, omdat die `auth.sellqo.app` / een nieuwe subdomain
  zou forceren in plaats van `info@yeketimotorworks.com`.

## Bestanden

- **Nieuw**: `supabase/functions/auth-email/index.ts`
- **Gewijzigd**: `supabase/functions/_shared/email-copy.ts` (+ 6 auth-secties)
- **Gewijzigd**: `src/lib/email-copy.server.ts` (mirror, voor consistentie)
- **Gewijzigd**: `supabase/config.toml` (function + auth-hook registreren)
- **Gewijzigd**: `src/routes/login.tsx` (locale meegeven in signUp opties)
- **Nieuwe secret**: `AUTH_EMAIL_HOOK_SECRET`

## Vereiste actie van jou (Baram), één keer

Na deploy moet de Auth-hook in Supabase eenmalig geactiveerd worden. Ik kan
dat via `supabase--configure_auth` doen, maar laat me weten of je het mee
wilt — anders zet ik de webhook + secret klaar en zie je hem in
Cloud → Auth → Hooks staan zodra je publiceert.

## Resultaat

Wachtwoord-reset, signup-bevestiging, invite, magic-link, email-wijziging en
reauthentication komen allemaal van **info@yeketimotorworks.com** met
exact dezelfde brass/cream layout als de mails die nu al goed renderen.
NL of EN op basis van de klant-locale.
