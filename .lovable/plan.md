
## Doel

Een duidelijk rood bolletje op "Berichten" tonen wanneer er ongelezen berichten
zijn — zowel in het klantportaal (header) als in admin (bottom-nav én desktop
top-nav). Vandaag is er enkel een goud bolletje in de admin bottom-nav, en aan
klantzijde helemaal niets.

## Wat klopt nu al

- Admin heeft `conversations.admin_last_seen_at`. Bij openen van een gesprek
  zet `getConversation` die op `now()`. AdminBottomNav telt ongelezen
  conversaties (`last_message_at > admin_last_seen_at`) en toont nu een
  goud bolletje.

## Wat er ontbreekt / fout zit

1. **Geen tracking aan klantzijde** — `conversations` heeft geen
   `customer_last_seen_at`, dus we kunnen niet weten of de klant het laatste
   admin-bericht al heeft gezien.
2. **Geen badge in `PortalHeader`** op de "Berichten"-link.
3. **Goud i.p.v. rood** in admin — de gebruiker wil expliciet rood
   ("rood notificatietje").
4. **Geen badge in de admin desktop top-nav** (`AdminShell`), enkel in de
   mobiele bottom-nav.

## Aanpak

### 1. Database (migratie)

Nieuwe migratie:
- Kolom `conversations.customer_last_seen_at timestamptz` toevoegen.
- Geen RLS-/policy-wijzigingen — bestaande policies dekken `UPDATE` door de
  klant op zijn eigen conversation al. (Verifiëren; indien niet, een nauwe
  `UPDATE`-policy toevoegen die enkel `customer_last_seen_at` mag muteren door
  `contact_profile_id = auth.uid()`. Géén bestaande policies aanraken.)

### 2. Server-functies (`src/lib/messages.functions.ts`)

- `getMyConversation` → na ophalen van de conversation `customer_last_seen_at`
  bumpen naar `now()` (zoals `getConversation` dat doet voor admin).
- Nieuwe lichte server-fn `getMyUnreadMessagesCount` (vereist auth) — telt of
  er een eigen conversation is waar `last_message_at > customer_last_seen_at`
  EN het laatste bericht niet van de klant zelf komt. Returnt `{ unread: 0|1 }`
  (één conversation per klant, dus volstaat boolean-achtig).
- Geen wijziging aan business logic of mail-pipeline.

### 3. Klantportaal (`src/components/PortalHeader.tsx`)

- Bij mount `getMyUnreadMessagesCount` ophalen.
- Rood bolletje rechtsboven de "Berichten"-link tonen wanneer `unread > 0`.
- Re-fetch bij route-wissel (eenvoudige `useRouterState`-trigger zoals in
  `AdminBottomNav`).

### 4. Admin

- **`AdminBottomNav.tsx`**: kleur van `Dot` van `var(--gold)` naar
  `var(--oxide)` (de bestaande rode/roest-token) zodat het visueel een
  notificatie wordt. Logica blijft identiek.
- **`AdminShell.tsx`** (desktop top-nav): zelfde teller-hook
  (conversations + quote_requests count zoals in bottom-nav) en hetzelfde
  rode bolletje naast "Berichten" en "Aanvragen". Eén gedeelde helper om
  duplicatie te vermijden: `src/hooks/useAdminUnreadCounts.ts` die de
  bestaande query uit `AdminBottomNav` herbruikt.

### 5. Niet doen

- Geen wijzigingen aan RLS-rollen, auth-flows, mail-templates of
  notify-events pipeline.
- Geen polling / realtime subscriptions toevoegen — refetch bij navigatie
  volstaat (zelfde patroon als nu).

## Technische details

```text
conversations
├── admin_last_seen_at         (bestaand)  → bumped door getConversation
└── customer_last_seen_at      (nieuw)     → bumped door getMyConversation

Badge-logica:
- Klant: unread = (laatste bericht != klant) AND last_message_at > customer_last_seen_at
- Admin: unread conv-count = aantal conversaties met last_message_at > admin_last_seen_at
- Admin: unread requests   = quote_requests waar status = 'new'
```

Rode kleur: hergebruik bestaande token `var(--oxide)` (al in het palet,
gebruikt voor "Sluiten" en `lost`-status), zodat de notificatie binnen de
huidige design tokens blijft.

## Bestanden

- **Nieuw**: `supabase/migrations/<ts>_add_customer_last_seen_at.sql`
- **Nieuw**: `src/hooks/useAdminUnreadCounts.ts`
- **Gewijzigd**: `src/lib/messages.functions.ts` (bump + nieuwe fn)
- **Gewijzigd**: `src/components/PortalHeader.tsx` (badge)
- **Gewijzigd**: `src/components/AdminBottomNav.tsx` (kleur + hook)
- **Gewijzigd**: `src/components/AdminShell.tsx` (badge op desktop nav)
