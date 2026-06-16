
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS customer_last_seen_at timestamptz;

CREATE POLICY "conversations_customer_update_own_seen"
  ON public.conversations
  FOR UPDATE
  TO authenticated
  USING (contact_profile_id = auth.uid())
  WITH CHECK (contact_profile_id = auth.uid());
