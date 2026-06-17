
-- ============================================================
-- 1) Quote form: remove open INSERT policy, add ticket system
-- ============================================================

DROP POLICY IF EXISTS "anyone can submit a quote request" ON public.quote_requests;

CREATE TABLE IF NOT EXISTS public.quote_upload_tickets (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  consumed_at timestamptz
);

GRANT ALL ON public.quote_upload_tickets TO service_role;
ALTER TABLE public.quote_upload_tickets ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (server functions) touches this table.

CREATE INDEX IF NOT EXISTS quote_upload_tickets_created_at_idx
  ON public.quote_upload_tickets (created_at);

-- Replace the constrained upload policy so the UUID prefix MUST correspond
-- to an existing, recent (< 1 hour) ticket.
DROP POLICY IF EXISTS "quote-photos constrained upload" ON storage.objects;

CREATE POLICY "quote-photos ticketed upload"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'quote-photos'
    AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]{1,160}$'
    AND coalesce(metadata ->> 'mimetype', '') LIKE 'image/%'
    AND coalesce((metadata ->> 'size')::bigint, 0) <= 8388608
    AND EXISTS (
      SELECT 1
        FROM public.quote_upload_tickets t
       WHERE t.id = (split_part(name, '/', 1))::uuid
         AND t.created_at > now() - interval '1 hour'
         AND t.consumed_at IS NULL
    )
  );

-- ============================================================
-- 2) Conversations: column-level lock for customers
-- ============================================================

CREATE OR REPLACE FUNCTION public.tg_conversations_customer_column_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypass (auth.uid() IS NULL) and admins keep full access.
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admin customers may only patch customer_last_seen_at.
  IF NEW.id                  IS DISTINCT FROM OLD.id
   OR NEW.contact_profile_id IS DISTINCT FROM OLD.contact_profile_id
   OR NEW.project_id         IS DISTINCT FROM OLD.project_id
   OR NEW.subject            IS DISTINCT FROM OLD.subject
   OR NEW.source             IS DISTINCT FROM OLD.source
   OR NEW.status             IS DISTINCT FROM OLD.status
   OR NEW.admin_last_seen_at IS DISTINCT FROM OLD.admin_last_seen_at
   OR NEW.last_message_at    IS DISTINCT FROM OLD.last_message_at
   OR NEW.created_at         IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Alleen customer_last_seen_at mag door de klant gewijzigd worden';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_conversations_customer_column_lock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS conversations_customer_column_lock ON public.conversations;
CREATE TRIGGER conversations_customer_column_lock
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.tg_conversations_customer_column_lock();

-- ============================================================
-- 3) SECURITY DEFINER hardening — revoke EXECUTE from anon/auth
-- Kept callable by authenticated:
--   - has_role(uuid, app_role)    -- used in RLS policies
--   - owns_project(uuid, uuid)    -- used in RLS policies
-- Everything else: internal use only (server functions via service_role
-- or trigger machinery). Revoke from anon + authenticated + PUBLIC.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_quote_number()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_project_reactions_seen(uuid)     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unread_customer_reactions(uuid[])     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_webhook_secret(text)           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.dispatch_notify_event(jsonb)          FROM PUBLIC, anon, authenticated;

-- Trigger functions are never invoked directly by clients; lock them down.
REVOKE EXECUTE ON FUNCTION public.tg_quote_request_inserted()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_quote_request_link_conversation()     FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_quote_request_sync_profile_locale()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_quote_status_notify()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_quote_lock_customer_update()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_recalc_quote_total()                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_update_reaction_inserted()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_phase_update_inserted()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_project_inserted()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_project_status_updated()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_project_phase_status_updated()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_profile_inserted()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_message_inserted()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_mirror_reaction_to_message()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_bump_conversation_last_message()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_activate_next_phase()               FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 4) Fix mutable search_path on queue wrappers
-- ============================================================

ALTER FUNCTION public.enqueue_email(text, jsonb)            SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint)            SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
