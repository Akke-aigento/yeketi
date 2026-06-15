# RLS Isolation Tests

End-to-end check that one authenticated customer cannot read, list, or
sign storage URLs for another customer's project data — and that a
non-admin user is redirected away from `/admin`.

The service role key is used **only** for setup (creating two test
users + seed data) and teardown (deleting them). All isolation
assertions are executed as the authenticated test user, never as
service role.

## What it checks (9 checks)

1. Sanity: B can read own project (RLS allows owner)
2. B blocked from A's project
3. B blocked from A's project_phases
4. B blocked from A's phase_updates
5. B blocked from A's update_photos
6. B denied direct GET on A's storage object
7. B denied signed-URL request for A's storage object
8. Sanity: B can sign own photo
9. Non-admin redirected from `/admin` to `/portaal` (Playwright)

Any failure exits non-zero, failing CI.

## Run locally

```bash
export SUPABASE_URL=https://<ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
export SUPABASE_PUBLISHABLE_KEY=<publishable-key>
export SUPABASE_PROJECT_ID=<ref>

# Optional, defaults to http://localhost:8080
# export APP_BASE_URL=http://localhost:8080

# Optional: skip the Playwright /admin redirect check
# export SKIP_UI=1

# Install Playwright once (for the UI check)
python -m pip install playwright
python -m playwright install chromium

# Make sure `bun run dev` is running, then:
python tests/rls/test_rls_isolation.py
```

## CI

Wired up in `.github/workflows/rls.yml`. It starts the Vite dev server,
waits for port 8080, runs the test, and fails the build if any of the
9 checks fail.

Required GitHub secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_URL` (same value as `SUPABASE_URL`)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (same value as `SUPABASE_PUBLISHABLE_KEY`)
- `VITE_SUPABASE_PROJECT_ID` (same value as `SUPABASE_PROJECT_ID`)

> The test creates its own throwaway users (`rls-a-<ts>@example.invalid`
> and `rls-b-<ts>@example.invalid`) and deletes them at the end. No
> reliance on pre-existing data.