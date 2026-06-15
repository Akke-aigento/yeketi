-- S-5: Lock down anonymous uploads to quote-photos bucket
DROP POLICY IF EXISTS "anyone can upload quote photos" ON storage.objects;

-- Anon/auth can upload only:
--   * to quote-photos bucket
--   * under a UUID/ prefix (one prefix per submission)
--   * image/* mimetype
--   * <= 8 MB
CREATE POLICY "quote-photos constrained upload"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'quote-photos'
  AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]{1,160}$'
  AND coalesce(metadata->>'mimetype','') LIKE 'image/%'
  AND coalesce((metadata->>'size')::bigint, 0) <= 8388608
);

-- Admins can read and delete quote photos (anon has no SELECT/DELETE — denied by default)
CREATE POLICY "quote-photos admin read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'quote-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "quote-photos admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'quote-photos' AND public.has_role(auth.uid(), 'admin'));
