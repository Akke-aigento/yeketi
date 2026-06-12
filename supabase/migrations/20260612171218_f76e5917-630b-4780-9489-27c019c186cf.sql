CREATE POLICY "anyone can upload quote photos"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'quote-photos');