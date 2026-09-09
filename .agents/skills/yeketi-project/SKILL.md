---
name: yeketi-project
description: >-
  Harde regels en projectcontext voor Yeketi Motorworks — het restauratieplatform voor
  klassieke auto's van klant Baram Maro. Toepassen bij élke wijziging in de
  Yeketi-repo of het Lovable-project yeketi: publieke site, klantportaal, adminpaneel,
  offertes en PDF's, de e-mailnotificaties (NL/EN), RLS en het rollensysteem,
  webhook-secrets, storage en de Playwright-CI. Bevat ook de naamafspraak rond de
  klant en de GDPR-status.
---

# Yeketi Motorworks — Projectregels

**Scope: enkel het project `yeketi`.**

> Dit bestand is een **ingevulde start**, geen afgeronde skill. De feiten
> hieronder kloppen op hoofdlijnen; de detailregels moeten nog met een recon
> tegen de echte repo gelegd worden. Wat nog niet geverifieerd is, staat
> gemarkeerd met `⚠ natrekken`.

---

## 1. Wat dit is

Restauratieplatform voor klassieke auto's. Gebouwd voor één externe klant.

- **Klant:** **Baram Maro** — een bijnaam, naar zijn overgrootvader.
- **Lovable-project:** `4fee59e8-4094-4b2a-b9f2-be1a7f65993a`

### Y1 — De naamafspraak (niet onderhandelbaar)

In **elke** Yeketi-uitvoer — code, commentaar, commit-messages, e-mailteksten,
website-copy, offertes, documentatie, PDF's — heet de klant **Baram Maro**.
Zijn echte achternaam komt nergens voor. Ook niet in een placeholder, ook niet
in een testfixture, ook niet in een seed.

Kom je hem ergens tegen: melden, niet stil vervangen.

---

## 2. Wat er staat

- Publieke site, klantportaal en adminpaneel
- Offerte- en PDF-systeem
- 12+ e-mailnotificaties, tweetalig (NL/EN)
- Security-hardening: RLS, rollensysteem, webhook-secrets, storage-policies
- Playwright-tests in CI

`⚠ natrekken` — per onderdeel de echte bestandspaden, tabelnamen en
edge-functies invullen. Zolang dat niet gebeurd is: eerst lezen, niet gokken.

---

## 3. Harde grenzen

### Y2 — Tweetaligheid is een harde eis, geen extraatje

Elke gebruikersgerichte tekst bestaat in **NL én EN**. Een nieuwe of gewijzigde
e-mail, foutmelding of UI-string zonder beide talen is niet af.

`⚠ natrekken` — waar de vertalingen leven, en of er een pariteitscheck in CI zit
(zoals SellQo die heeft). Zo niet: dat is de eerste automatisering die hier
loont.

### Y3 — Security is al gehard; hou het zo

RLS, rollen, webhook-secrets en storage-policies zijn bewust ingericht. Een
wijziging die er langs komt, wordt expliciet verantwoord: welke policy, welke
rol, waarom veilig.

`⚠ natrekken` — het rollenmodel en de policies concreet uitschrijven, zodat een
review niet elke keer opnieuw begint.

### Y4 — GDPR: het privacybeleid was de enige blocker

De pre-launch GDPR-audit is gedaan. De harde blocker was een
placeholder-privacybeleid. Voor de livegang staat: **geen placeholder-tekst in
juridische pagina's.**

`⚠ natrekken` — is dit inmiddels opgelost, en staat de definitieve tekst er?

---

## 4. Slottaken per batch

`⚠ natrekken` — Yeketi heeft (nog) geen paper trail zoals SellQo. Beslis of dat
hier nodig is. Voor een project met één klant is een `docs/role-audit.md` met
root-cause-eerst waarschijnlijk genoeg; changelog, doc_articles en nieuwsbrief
zijn SellQo-machinerie die hier niet hoort.

---

## 5. Wat hier niet staat

Werkwijze, mobiele conventies en connector-gebruik staan in de personal skills
`nomadix-werkwijze`, `nomadix-mobiel` en `nomadix-lovable-connector`. Herhaal ze
hier niet.
