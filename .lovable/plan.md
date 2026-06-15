## Status van wat er al staat ✅

Veel ligt er al — ik ga niet vanaf nul herbouwen. Snelle inventaris:

- **DB & RLS:** alle tabellen bestaan (`profiles`, `projects`, `project_phases`, `phase_updates`, `update_photos`, `quote_requests`). RLS staat correct met `is_admin()` + `owns_project()` security-definer functies. Trigger `auto_activate_next_phase` werkt al.
- **Storage:** private bucket `project-photos` bestaat.
- **Routes:** `/portaal`, `/portaal/$projectId`, `/admin`, `/admin/offertes`, `/admin/projecten/$id`, `/admin/klanten` bestaan allemaal (132–393 regels per file).
- **Quote conversion:** `convertQuoteToProject` server-fn werkt en seed't de 7 default fases.

⚠️ **Verschil met je spec:** quote_requests gebruikt Nederlandse kolomnamen (`naam`, `telefoon`, `merk`, `model`, `bouwjaar`, `type_werk`, `beschrijving`). Spec vraagt Engelse namen. Voorstel: NL behouden — alles is daar al op gewired.

---

## Wat ik wil afmaken (gefaseerd, in volgorde)

### Fase 1 — Audit & QA van bestaande flow (geen nieuwe features, eerst zeker weten dat huidige werkt)
- Lees elke bestaande route door, draai Playwright als admin én klant tegen preview.
- Verifieer RLS écht: klant A logt in → kan klant B niet zien (DB-query test via `requireSupabaseAuth`).
- Verifieer dat alle `update_photos` via **signed URLs** geserveerd worden (niet public).
- Lijst van concrete gaps & bugs maak ik klaar voor jou.

### Fase 2 — Klantportaal afwerken (`/portaal/$projectId`)
- **Visuele tijdlijn** met verticale rail: brass-gevulde dot (done), pulserende ring (active), hollow outline (pending).
- **Lightbox** voor foto's: swipe op mobile, pijltjes op desktop, esc/tap to close.
- "Nog niet gestart" placeholder onder pending fases.
- Skeleton-states op lijst + tijdlijn.
- `prefers-reduced-motion` → puls uit.

### Fase 3 — Admin update-flow ≤ 3 taps (`/admin/projecten/$id`)
- Sticky `+ Nieuwe update` knop (bottom op mobile).
- Stap 1 fase-picker (default = active), stap 2 body, stap 3 foto's via `<input capture="environment" multiple>`.
- **Client-side image compress** naar max 1920px / ~300KB JPEG vóór upload (er bestaat al `src/lib/image-compress.ts` — herbruiken).
- Upload **per foto** met progress + retry per stuk (niet all-or-nothing).
- Edit/delete per update; delete verwijdert ook storage-objects.
- "WhatsApp klant" knop met prefilled bericht.

### Fase 4 — Admin project-management
- Fasemanager: add / rename / remove / **drag-to-reorder**.
- Edit project info + status, bevestigdialog voor destructieve acties.
- Optimistic UI op status changes.

### Fase 5 — Admin dashboard & overige
- **Dashboard stats**: actieve projecten, nieuwe offertes, projecten zonder update in ≥7 dagen.
- "Stale eerst" sorting op actieve projectenlijst.
- `/admin/projecten` index: filter op status, search op voertuig/klant.
- Offertes: status pipeline (new → contacted → quoted → won → lost) inline editable, WhatsApp + Bel + "Maak project" knoppen.
- Klanten: invite/resend + edit naam/telefoon (al deels aanwezig).

### Fase 6 — Polish & verificatie
- Loading skeletons overal.
- Confirm-dialogs op alle destructieve acties.
- Playwright-test door volledige flow: klant logt in → ziet alleen eigen project → admin maakt update → klant ziet update + foto via signed URL.

---

## Wat ik je moet vragen vóór ik start

1. **Volgorde**: wil je fase 1→6 in deze volgorde (veiligste — eerst audit, dan invullen wat ontbreekt), of meteen door op een specifieke fase? *Aanrader: ik doe **fase 1 (audit)** eerst en lever je een korte lijst met gevonden gaps. Dan beslis jij waar we naar springen.*
2. **Quote-request kolomnamen NL houden?** Verstandig — anders breekt veel bestaande code. Bevestig.
3. **WhatsApp-bericht copy** voor admin-knoppen: oké met *"Hoi {voornaam}, er staat een nieuwe update van je {vehicle} klaar in je Yeketi portaal: {url}"*?
4. Eerder vandaag stond de domein-setup voor `mail.yeketimotorworks.com` open — wil je dat ik die afzonderlijk afwerk zodra de DNS verified is, of mag dat parallel?

Geef antwoord op deze 4 en ik begin met **fase 1 (audit + Playwright sweep)** zodat we niets dubbel bouwen.
