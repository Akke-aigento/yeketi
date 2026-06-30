## Doel
Korte video's (±10–15s) toelaten op alle plekken waar nu foto's geüpload worden: project-updates (klantportaal), recent werk en de publieke offerte-aanvraag.

## Aanpak in het kort
We hergebruiken de bestaande `update_photos` / `recent_work_items` tabellen en breiden ze uit met een `media_type` ('image' | 'video') + optioneel `poster_path` (thumbnail). Geen aparte tabel — minder code, één sort-order, één galerij.

## Limieten (server + client afgedwongen)
- **Duur**: max 20s (geeft marge boven 15s voor MOV/HEVC variaties).
- **Bestandsgrootte**: max 50 MB per video.
- **Formaten**: `video/mp4`, `video/quicktime` (iPhone .mov), `video/webm`.
- Validatie client-side via `<video>.duration` vóór upload; server-side via een check in een SECURITY DEFINER functie (grootte + mime) zodat de `anon` offerte-flow niet te omzeilen is.

## Database
1. Migration:
   - `ALTER TABLE update_photos ADD COLUMN media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image','video'))`
   - `ALTER TABLE update_photos ADD COLUMN poster_path text` (auto-gen thumb, optioneel)
   - Idem op `recent_work_items`.
   - `quote_upload_tickets`: max size verhogen / mime allowlist uitbreiden in de validator-functie.
2. Storage policies: bestaande buckets (`project-photos`, `recent-work`, `quote-uploads`) accepteren al elk MIME-type via RLS; geen wijziging nodig behalve grootte-check in de ticket-validator.

## Frontend
1. **Nieuw util** `src/lib/media.ts`:
   - `pickMedia(file)`: type-detect (image/video), duur-check, returnt `{ kind, durationSec, posterBlob? }`.
   - `generatePoster(file)`: trekt frame op 1s uit video via `<video>` + `<canvas>` → JPEG blob.
   - `MediaThumb` component: rendert `<img>` of `<video muted playsinline preload="metadata">` met play-icoon overlay.
2. **Plekken aanpassen** (`accept="image/*,video/mp4,video/quicktime,video/webm"`):
   - `src/routes/_authenticated/admin/projecten.$id.tsx` (3 inputs: cover, update-foto's, mobiele camera)
   - `src/routes/_authenticated/admin/projecten.index.tsx` (nieuw project cover)
   - `src/routes/_authenticated/admin/recent-werk.$id.tsx` (cover + items)
   - `src/routes/offerte.tsx` (publieke aanvraag)
   - `NewUpdateModal` (project-updates popup)
3. **Galerij/lightbox** in klantportaal + admin: video's renderen met `controls`, foto's blijven `<img>`.

## Wat ik bewust NIET doe
- Geen server-side transcoding (zware infra, niet nodig voor 15s clips).
- Geen HLS streaming — directe MP4 via signed URL volstaat voor deze duur/grootte.
- Geen aparte "videos" tabel.

## Open vraag
Akkoord met **20s / 50 MB / MP4+MOV+WebM**, of wil je strakkere limieten (bv. exact 15s / 25 MB) om dataverbruik bij klanten op mobiel te beperken?
