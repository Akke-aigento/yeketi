ALTER TABLE public.update_photos
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image','video')),
  ADD COLUMN IF NOT EXISTS poster_path text;

ALTER TABLE public.recent_work_items
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image'
    CHECK (media_type IN ('image','video')),
  ADD COLUMN IF NOT EXISTS poster_path text;