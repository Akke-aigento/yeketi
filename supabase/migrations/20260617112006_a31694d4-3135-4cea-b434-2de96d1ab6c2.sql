
CREATE OR REPLACE FUNCTION public.quote_upload_ticket_valid(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quote_upload_tickets t
    WHERE t.id = _id
      AND t.consumed_at IS NULL
      AND t.created_at > now() - interval '1 hour'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.quote_upload_ticket_valid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_upload_ticket_valid(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "quote-photos ticketed upload" ON storage.objects;

CREATE POLICY "quote-photos ticketed upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'quote-photos'
    AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]{1,160}$'
    AND COALESCE(metadata->>'mimetype','') LIKE 'image/%'
    AND COALESCE((metadata->>'size')::bigint, 0) <= 8388608
    AND public.quote_upload_ticket_valid((split_part(name, '/', 1))::uuid)
  );
