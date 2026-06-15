
-- Notify failure log (R-1 / R-2)
CREATE TABLE public.notify_event_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  source text NOT NULL,
  payload_summary jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notify_event_failures TO authenticated;
GRANT ALL ON public.notify_event_failures TO service_role;

ALTER TABLE public.notify_event_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read notify failures"
  ON public.notify_event_failures FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete notify failures"
  ON public.notify_event_failures FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX notify_event_failures_created_idx
  ON public.notify_event_failures (created_at DESC);

-- Make dispatch_notify_event log dispatch failures (DB -> edge) without
-- blocking the original insert. The function is SECURITY DEFINER so the
-- insert succeeds regardless of caller role; trigger-side exceptions are
-- still swallowed.
CREATE OR REPLACE FUNCTION public.dispatch_notify_event(_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_secret text;
  v_url text;
  v_table text;
BEGIN
  v_table := COALESCE(_payload->>'table', 'unknown');
  BEGIN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name = 'WEBHOOK_SHARED_SECRET' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_secret := NULL;
  END;
  IF v_secret IS NULL THEN
    BEGIN
      INSERT INTO public.notify_event_failures(event_type, source, payload_summary, error_message)
      VALUES (v_table, 'dispatch', _payload, 'WEBHOOK_SHARED_SECRET not configured');
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN;
  END IF;
  v_url := 'https://tipkyhpymhcqrnckwkni.supabase.co/functions/v1/notify-events';
  BEGIN
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type','application/json','x-webhook-secret', v_secret),
      body    := _payload,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify dispatch failed: %', SQLERRM;
    BEGIN
      INSERT INTO public.notify_event_failures(event_type, source, payload_summary, error_message)
      VALUES (v_table, 'dispatch', _payload, SQLERRM);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END;
END;
$function$;
