
-- Required extension for HTTP calls from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Helper: send a notify_events webhook with the shared secret.
-- Reads secrets from Vault (set by Lovable when WEBHOOK_SHARED_SECRET is added).
CREATE OR REPLACE FUNCTION public.dispatch_notify_event(_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'WEBHOOK_SHARED_SECRET' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_secret := NULL;
  END;
  IF v_secret IS NULL THEN
    -- Secret not configured yet; skip silently so app inserts don't fail.
    RETURN;
  END IF;

  v_url := 'https://tipkyhpymhcqrnckwkni.supabase.co/functions/v1/notify-events';

  PERFORM extensions.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := _payload,
    timeout_milliseconds := 5000
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.dispatch_notify_event(jsonb) FROM PUBLIC, anon, authenticated;

-- Trigger: phase_updates INSERT
CREATE OR REPLACE FUNCTION public.tg_phase_update_inserted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_notify_event(jsonb_build_object(
    'type', 'INSERT',
    'table', 'phase_updates',
    'record', to_jsonb(NEW)
  ));
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_phase_update_inserted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER phase_updates_notify
  AFTER INSERT ON public.phase_updates
  FOR EACH ROW EXECUTE FUNCTION public.tg_phase_update_inserted();

-- Trigger: quote_requests INSERT
CREATE OR REPLACE FUNCTION public.tg_quote_request_inserted()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.dispatch_notify_event(jsonb_build_object(
    'type', 'INSERT',
    'table', 'quote_requests',
    'record', to_jsonb(NEW)
  ));
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.tg_quote_request_inserted() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER quote_requests_notify
  AFTER INSERT ON public.quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.tg_quote_request_inserted();
