-- Enum
CREATE TYPE public.recent_work_status AS ENUM ('draft', 'published');

-- ============================================================
-- recent_work_publications
-- ============================================================
CREATE TABLE public.recent_work_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT,
  vehicle_label TEXT,
  year_label TEXT,
  status public.recent_work_status NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  cover_photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.recent_work_publications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recent_work_publications TO authenticated;
GRANT ALL ON public.recent_work_publications TO service_role;

ALTER TABLE public.recent_work_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published publications"
  ON public.recent_work_publications FOR SELECT
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert publications"
  ON public.recent_work_publications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update publications"
  ON public.recent_work_publications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete publications"
  ON public.recent_work_publications FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER recent_work_publications_updated_at
  BEFORE UPDATE ON public.recent_work_publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- recent_work_items
-- ============================================================
CREATE TABLE public.recent_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES public.recent_work_publications(id) ON DELETE CASCADE,
  photo_path TEXT NOT NULL,
  date_label TEXT,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX recent_work_items_pub_idx ON public.recent_work_items(publication_id, sort_order);

GRANT SELECT ON public.recent_work_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recent_work_items TO authenticated;
GRANT ALL ON public.recent_work_items TO service_role;

ALTER TABLE public.recent_work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view items of published publications"
  ON public.recent_work_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recent_work_publications p
      WHERE p.id = recent_work_items.publication_id
        AND (p.status = 'published' OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Admins insert items"
  ON public.recent_work_items FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update items"
  ON public.recent_work_items FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete items"
  ON public.recent_work_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER recent_work_items_updated_at
  BEFORE UPDATE ON public.recent_work_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Storage policies for the (to-be-created) "recent-work" public bucket.
-- Public SELECT is implied by the public bucket flag.
-- ============================================================
CREATE POLICY "Admins upload recent-work objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recent-work' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update recent-work objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'recent-work' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'recent-work' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete recent-work objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recent-work' AND public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- Seed: migrate the hardcoded VW T2 Westfalia case study
-- (photo_path stores existing CDN URLs; the app treats values
-- starting with "/" or "http" as direct URLs.)
-- ============================================================
INSERT INTO public.recent_work_publications
  (id, title, subtitle, vehicle_label, year_label, status, sort_order, cover_photo_path)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'VW T2 Westfalia — van schuurvondst tot bergpas.',
  'Een originele Westfalia camper, binnengebracht met sporen van jarenlang stilstaan. Focus lag op plaatwerk, slaapdak en exterieur — techniek en interieur bleven in deze fase buiten beschouwing. Hieronder de chronologie, van eerste inspectie tot eerste rit door de bergen.',
  'VW T2 Westfalia',
  '2024',
  'published',
  0,
  '/__l5e/assets-v1/bdb2d621-3d83-43c7-8fa3-be23ee09b5b6/t2-07-onderweg.jpg'
);

INSERT INTO public.recent_work_items
  (publication_id, photo_path, date_label, caption, sort_order)
VALUES
  ('11111111-1111-1111-1111-111111111111', '/__l5e/assets-v1/dc5e23c9-3aad-4968-9538-d9e4d142de43/t2-01-aankomst.jpg',         'MEI 2024',  'Aankomst — Baram en de eigenaar overlopen de staat van de bus.', 0),
  ('11111111-1111-1111-1111-111111111111', '/__l5e/assets-v1/eba61c31-504a-41ef-9e93-35a48503f508/t2-03-inspectie-voor.jpg',   'MEI 2024',  'Inventaris — alle originele delen blijven behouden waar het kan.', 1),
  ('11111111-1111-1111-1111-111111111111', '/__l5e/assets-v1/665efd62-8d47-436d-8c9c-a906391e6a8a/t2-02-inspectie-zij.jpg',    'MEI 2024',  'Slaapdak opgemeten, kap en scharnieren grondig nagekeken.', 2),
  ('11111111-1111-1111-1111-111111111111', '/__l5e/assets-v1/5787b729-83d4-4bc2-9ba3-4d454d38f41e/t2-04-strippen.jpg',         'MEI 2024',  'Ontmanteling — rubbers, ramen en sierlijsten gaan eruit voor het plaatwerk.', 3),
  ('11111111-1111-1111-1111-111111111111', '/__l5e/assets-v1/9d564bda-5885-4be8-bd78-529ef2b03fe5/t2-05-plamuur.jpg',          'MEI 2024',  'Plamuur en schuurwerk — laag per laag tot het oppervlak weer strak is.', 4),
  ('11111111-1111-1111-1111-111111111111', '/__l5e/assets-v1/e0d90c1b-2b91-4c8a-946b-8176a41b3901/t2-06-eindcontrole-klant.jpg','MEI 2024',  'Eindcontrole — Baram tekent pas af als élk detail klopt.', 5),
  ('11111111-1111-1111-1111-111111111111', '/__l5e/assets-v1/bdb2d621-3d83-43c7-8fa3-be23ee09b5b6/t2-07-onderweg.jpg',         'JUNI 2024', 'Onderweg — de bus rijdt weer waar hij thuishoort.', 6);
