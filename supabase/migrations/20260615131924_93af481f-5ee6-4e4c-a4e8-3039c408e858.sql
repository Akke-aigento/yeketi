
CREATE OR REPLACE FUNCTION public.__read_webhook_secret_once()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'WEBHOOK_SHARED_SECRET' LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.__read_webhook_secret_once() TO PUBLIC;
