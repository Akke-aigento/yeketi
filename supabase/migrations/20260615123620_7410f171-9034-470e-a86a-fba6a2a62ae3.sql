CREATE OR REPLACE FUNCTION public.dispatch_notify_event(_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_secret text;
  v_url text;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'WEBHOOK_SHARED_SECRET' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_secret := NULL;
  END;
  IF v_secret IS NULL THEN RETURN; END IF;
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
  END;
END;
$function$;