## Doel
Mobile admin-navigatie vervangen door een vaste bottom tab bar met "Meer"-sheet, en de tab-volgorde herordenen volgens de natuurlijke werkfunnel. Desktop behoudt huidige top-nav (geen scroll nodig op die breedte). Geen wijzigingen aan logic, RLS, of data.

## Nieuwe tab-volgorde (overal)
`Dashboard · Berichten · Aanvragen · Offertes · Projecten · Klanten · Recent Werk · Instellingen`

Volgt de funnel: inbox → lead → offerte → werk → klant → marketing → config.

## Mobile bottom tab bar

### Layout
Vaste balk onderaan het scherm (alleen `< sm`), in Yeketi-stijl:
- Achtergrond `var(--charcoal)`, bovenrand `var(--brass)`, `safe-area-inset-bottom` padding.
- 5 slots, gelijke breedte:
  1. **Dashboard** (icoon: gauge)
  2. **Berichten** (icoon: message-square, met unread badge in `var(--gold)`)
  3. **Aanvragen** (icoon: inbox, met "nieuw"-badge)
  4. **Projecten** (icoon: wrench)
  5. **Meer** (icoon: more-horizontal) — opent sheet
- Icoon ~20px + label `text-[10px] uppercase tracking-[0.18em]`. Actief = `var(--gold)`, inactief = `var(--cream)` op 65% opacity, met dunne gold accent-streep boven.
- Hoofd-content krijgt `pb-20 sm:pb-0` zodat niets onder de balk verdwijnt.

### "Meer"-sheet
shadcn `Sheet` (side="bottom"), rustige editorial lijst:
- Offertes
- Klanten
- Recent Werk
- Instellingen
- divider
- Email-adres (read-only) + "Uitloggen" knop in `var(--gold)`
- "Naar de site →" link

Sluit automatisch bij route-wissel. Respecteert `prefers-reduced-motion`.

### Desktop (`sm:` en hoger)
Huidige top-nav blijft, maar:
- Tabs herordend volgens nieuwe volgorde.
- `overflow-x-auto` + mask-fade weg (niet meer nodig — 8 tabs passen op desktop).
- Bottom bar verborgen (`sm:hidden`).

## Top-header op mobile
Vereenvoudigen nu de tabs naar beneden gaan:
- Alleen logo "Yeketi Admin" links + "Uitloggen" rechts.
- Geen tweede rij meer. Veel rustiger.

## Badges
- Berichten-tab toont rode/gouden dot bij ongelezen klant-berichten (hergebruik bestaande unread-query uit dashboard).
- Aanvragen-tab toont dot bij status `new` aanvragen.
- In "Meer"-knop: dot als er iets in de overflow-tabs aandacht vraagt (bv. instellingen-warning) — voor nu alleen visueel voorzien, geen logica vereist.

## Portal-header
Portal heeft maar 2 echte tabs (Overzicht, Berichten) + Admin-link voor admins. Daar is geen bottom bar nodig — huidige aanpak werkt prima, niet aanraken behalve eventueel de Admin-link consistenter maken. **Geen wijziging in deze ronde** tenzij gewenst.

## Bestanden
- `src/components/AdminShell.tsx` — tabs-array herordenen, mobile top-nav vereenvoudigen, desktop nav schoonmaken, bottom bar renderen via nieuwe component, `pb-20 sm:pb-0` op main.
- `src/components/AdminBottomNav.tsx` (nieuw) — bottom bar + "Meer"-sheet, unread badges.
- Hergebruik bestaande Supabase queries voor badge-counts (geen nieuwe RPC's).

## Wat we NIET doen
- Geen wijziging aan routes, loaders, RLS, server functions.
- Geen iconen-only desktop variant.
- Geen portal-navigatie wijzigen.
