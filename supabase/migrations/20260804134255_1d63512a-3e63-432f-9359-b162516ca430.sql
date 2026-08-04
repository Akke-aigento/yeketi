CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.config (
  key text PRIMARY KEY,
  value text NOT NULL
);

REVOKE ALL ON TABLE private.config FROM PUBLIC;
REVOKE ALL ON TABLE private.config FROM anon, authenticated;
GRANT SELECT ON TABLE private.config TO service_role;

ALTER TABLE private.config ENABLE ROW LEVEL SECURITY;

INSERT INTO private.config (key, value)
VALUES ('health_token', 'CHANGE_ME')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_health_token()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT value FROM private.config WHERE key = 'health_token' LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_health_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_health_token() TO service_role;

CREATE OR REPLACE FUNCTION public.get_last_cron_run(p_jobname text)
RETURNS TABLE(status text, start_time timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = cron, public
AS $$
  SELECT d.status::text, d.start_time
    FROM cron.job j
    JOIN cron.job_run_details d ON d.jobid = j.jobid
   WHERE j.jobname = p_jobname
   ORDER BY d.runid DESC
   LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_last_cron_run(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_last_cron_run(text) TO service_role;