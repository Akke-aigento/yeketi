
CREATE OR REPLACE FUNCTION public.verify_webhook_secret(provided text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_expected text;
BEGIN
  IF provided IS NULL OR length(provided) = 0 THEN RETURN false; END IF;
  SELECT decrypted_secret INTO v_expected
    FROM vault.decrypted_secrets WHERE name = 'WEBHOOK_SHARED_SECRET' LIMIT 1;
  IF v_expected IS NULL THEN RETURN false; END IF;
  -- length-then-XOR comparison to keep timing roughly constant
  IF length(provided) <> length(v_expected) THEN RETURN false; END IF;
  RETURN provided = v_expected;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.verify_webhook_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_webhook_secret(text) TO service_role;

DROP FUNCTION IF EXISTS public.__read_webhook_secret_once();
