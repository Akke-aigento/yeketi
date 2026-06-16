
-- Grants for messages system (PostgREST visibility through RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

-- Allow customers to create their own conversation row (one-to-one with profile).
DROP POLICY IF EXISTS conversations_customer_insert_own ON public.conversations;
CREATE POLICY conversations_customer_insert_own ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (contact_profile_id = auth.uid());

-- Settings for admin notifications (e.g. Baram's personal alert email).
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_admin_all ON public.app_settings;
CREATE POLICY app_settings_admin_all ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Notify admin when a customer posts a message.
CREATE OR REPLACE FUNCTION public.tg_message_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender = 'klant' THEN
    PERFORM public.dispatch_notify_event(jsonb_build_object(
      'type', 'INSERT',
      'table', 'messages',
      'record', to_jsonb(NEW)
    ));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS messages_inserted_notify ON public.messages;
CREATE TRIGGER messages_inserted_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_message_inserted();
