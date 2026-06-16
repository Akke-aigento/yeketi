
CREATE TYPE public.conversation_source AS ENUM ('contact_form', 'quote_request', 'manual');
CREATE TYPE public.conversation_status AS ENUM ('open', 'gesloten');
CREATE TYPE public.message_sender AS ENUM ('klant', 'admin', 'systeem');

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  subject text,
  source public.conversation_source NOT NULL DEFAULT 'manual',
  status public.conversation_status NOT NULL DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  admin_last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_contact_unique UNIQUE (contact_profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_admin_all" ON public.conversations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "conversations_customer_select_own" ON public.conversations
  FOR SELECT TO authenticated
  USING (contact_profile_id = auth.uid());

CREATE INDEX conversations_last_message_idx ON public.conversations(last_message_at DESC);
CREATE INDEX conversations_project_idx ON public.conversations(project_id);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender public.message_sender NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX messages_conv_created_idx ON public.messages(conversation_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_admin_all" ON public.messages
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "messages_customer_select_own" ON public.messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND c.contact_profile_id = auth.uid()
  ));

CREATE POLICY "messages_customer_insert_own" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender = 'klant'
    AND author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.contact_profile_id = auth.uid()
        AND c.status = 'open'
    )
  );

-- Bump conversation.last_message_at when a message lands.
CREATE OR REPLACE FUNCTION public.tg_bump_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
     SET last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END $$;

CREATE TRIGGER bump_conversation_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_bump_conversation_last_message();

-- Public-form rate limiting (server-only).
CREATE TABLE public.public_form_submissions (
  id bigserial PRIMARY KEY,
  ip text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pfs_ip_kind_idx ON public.public_form_submissions(ip, kind, created_at DESC);
GRANT ALL ON public.public_form_submissions TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.public_form_submissions_id_seq TO service_role;
ALTER TABLE public.public_form_submissions ENABLE ROW LEVEL SECURITY;
-- No policies → only service_role (bypasses RLS) can read/write.

-- When a new quote_request lands AND a profile already exists for that email,
-- ensure a conversation exists and log a 'systeem' note. For brand-new leads
-- (no profile yet) the server function handles it after creating the auth user.
CREATE OR REPLACE FUNCTION public.tg_quote_request_link_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_profile uuid;
  v_conv uuid;
  v_subject text;
BEGIN
  v_email := lower(trim(COALESCE(NEW.email, '')));
  IF v_email = '' THEN RETURN NEW; END IF;

  SELECT id INTO v_profile FROM public.profiles WHERE lower(email) = v_email LIMIT 1;
  IF v_profile IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_conv FROM public.conversations WHERE contact_profile_id = v_profile LIMIT 1;
  v_subject := NULLIF(trim(concat_ws(' ', NEW.merk, NEW.model, NEW.bouwjaar)), '');
  IF v_subject IS NULL THEN v_subject := 'Offerteaanvraag'; END IF;

  IF v_conv IS NULL THEN
    INSERT INTO public.conversations(contact_profile_id, subject, source)
    VALUES (v_profile, v_subject, 'quote_request')
    RETURNING id INTO v_conv;
  END IF;

  INSERT INTO public.messages(conversation_id, author_id, sender, body)
  VALUES (
    v_conv, NULL, 'systeem',
    'Nieuwe offerteaanvraag: ' || v_subject ||
    CASE WHEN NEW.beschrijving IS NOT NULL AND NEW.beschrijving <> ''
         THEN E'\n\n' || NEW.beschrijving ELSE '' END
  );
  RETURN NEW;
END $$;

CREATE TRIGGER quote_request_link_conversation
  AFTER INSERT ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_quote_request_link_conversation();
