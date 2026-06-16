CREATE POLICY "Admins read recent-work objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recent-work' AND public.has_role(auth.uid(), 'admin'));
