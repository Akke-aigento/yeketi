# CLAUDE.md — werkwijze voor Yeketi Motorworks

Instructies voor Claude Code in deze repo. Lees dit vóór je iets wijzigt.

> Werkwijze (recon → go → post-flight), mobiele conventies en het gebruik van de
> Lovable-connector staan in de personal skills `nomadix-werkwijze`,
> `nomadix-mobiel` en `nomadix-lovable-connector`. Herhaal ze hier niet — dit
> bestand gaat alleen over wat aan **dit project** eigen is.

## 1. Wat is dit

Restauratieplatform voor klassieke auto's: publieke site, klantportaal,
adminpaneel, offerte- en PDF-systeem, tweetalige e-mailnotificaties (NL/EN).
Gebouwd voor één externe klant.

- **Klant:** **Baram Maro** — een bijnaam. Zijn echte achternaam komt nergens
  voor, in geen enkel bestand. Zie `yeketi-project` §Y1.
- **Lovable-project:** `4fee59e8-4094-4b2a-b9f2-be1a7f65993a`
- **Live:** https://yeketi.lovable.app
- **Stack:** TanStack Start (TypeScript), bun, Tailwind + shadcn/ui, Supabase.
  `⚠ aanvullen na recon` — edge functions, mailprovider, PDF-generatie.

## 2. Skills bij dit project

| Skill | Waar | Bron |
|---|---|---|
| `yeketi-project` | `.claude/skills/` | repo |
| `yeketi-project` | `.agents/skills/` | spiegel van `.claude/skills/` |

Locaties verschillen per lezer: `.claude/skills/` leest Claude Code,
`.agents/skills/` leest de Lovable-agent, workspace-skills lezen álle projecten
in de workspace. De harde regels (Y1–Y4) staan daarnaast in de project knowledge
van het Lovable-project, zodat de agent ze altijd in beeld heeft.

## 3. Documenten

`⚠ invullen na recon` — welke docs bestaan er in deze repo en waar gaan ze over.

## 4. De harde grenzen

- **Klantnaam**: altijd "Baram Maro", overal. Nooit de echte achternaam.
- **Tweetalig**: elke gebruikersgerichte tekst in NL én EN.
- **Security**: RLS, rollen, webhook-secrets en storage-policies zijn bewust
  ingericht — een wijziging eraan wordt expliciet verantwoord.
- **Juridische pagina's**: geen placeholder-tekst. Dat was de GDPR-blocker.

## 5. Slottaken per batch

`⚠ beslissen` — zie `yeketi-project` §4.

## 6. Wat Claude Code hier niet kan

`⚠ invullen` — waarschijnlijk hetzelfde patroon als bij SellQo: geen directe
Supabase-toegang, geen migraties draaien, geen deploys. Dat loopt via de
Lovable-connector.

## 7. Praktische notities

`⚠ vullen tijdens het werk` — dingen die tijd kosten als je ze niet weet.

**Antwoord in het Nederlands.**
