#!/usr/bin/env python3
"""
RLS isolation test for Yeketi Motorworks.

Creates two fresh test customers (A and B), seeds each with a project +
phase + update + photo using the service role, then asserts — as an
authenticated end-user (NOT service role) — that customer B cannot read
or sign any of customer A's data. Also verifies that a non-admin user
hitting /admin is redirected away.

Both test users are torn down in the `finally` block.

Required env vars:
  SUPABASE_URL                     e.g. https://xxx.supabase.co
  SUPABASE_SERVICE_ROLE_KEY        service role key (setup/teardown only)
  SUPABASE_PUBLISHABLE_KEY         anon/publishable key (used by user calls)
  SUPABASE_PROJECT_ID              project ref (for default storage key)

Optional:
  APP_BASE_URL                     default http://localhost:8080
  SKIP_UI                          set to "1" to skip the Playwright check
  LOVABLE_BROWSER_SUPABASE_STORAGE_KEY  override localStorage key name

Exit code 0 if all checks pass, 1 otherwise.
"""
import os, json, time, asyncio, sys, urllib.request, urllib.error
from pathlib import Path

URL = os.environ["SUPABASE_URL"].rstrip("/")
SRK = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
ANON = os.environ["SUPABASE_PUBLISHABLE_KEY"]
APP = os.environ.get("APP_BASE_URL", "http://localhost:8080").rstrip("/")
STORAGE_KEY = (
    os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    or f"sb-{os.environ['SUPABASE_PROJECT_ID']}-auth-token"
)
PASS = "TestPass!2026xyz"


def req(method, path, *, token=None, body=None, headers=None, key=None):
    use_key = key or (SRK if token == SRK else ANON)
    h = {"apikey": use_key, "Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    if headers:
        h.update(headers)
    data = (
        bytes(body)
        if isinstance(body, (bytes, bytearray))
        else (json.dumps(body).encode() if body is not None else None)
    )
    r = urllib.request.Request(URL + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers or {})


def admin(method, path, body=None, headers=None):
    return req(method, path, token=SRK, body=body, headers=headers)


def create_user(email):
    s, b, _ = admin(
        "POST",
        "/auth/v1/admin/users",
        body={
            "email": email,
            "password": PASS,
            "email_confirm": True,
            "user_metadata": {"full_name": email},
        },
    )
    assert s in (200, 201), (s, b)
    return json.loads(b)["id"]


def seed(uid, label):
    admin(
        "POST",
        "/rest/v1/profiles",
        body={"id": uid, "email": f"{label}@example.invalid", "full_name": label, "is_admin": False},
        headers={"Prefer": "resolution=merge-duplicates"},
    )
    s, b, _ = admin(
        "POST",
        "/rest/v1/projects",
        body={
            "customer_id": uid,
            "title": f"Test {label}",
            "vehicle_make": "Test",
            "vehicle_model": label,
            "vehicle_year": "1970",
            "status": "in_workshop",
        },
        headers={"Prefer": "return=representation"},
    )
    assert s in (200, 201), (s, b)
    pid = json.loads(b)[0]["id"]
    s, b, _ = admin(
        "POST",
        "/rest/v1/project_phases",
        body={"project_id": pid, "name": "Demontage", "sort_order": 0, "status": "active"},
        headers={"Prefer": "return=representation"},
    )
    assert s in (200, 201), (s, b)
    phase_id = json.loads(b)[0]["id"]
    s, b, _ = admin(
        "POST",
        "/rest/v1/phase_updates",
        body={"phase_id": phase_id, "body": f"Update voor {label}", "created_by": uid},
        headers={"Prefer": "return=representation"},
    )
    assert s in (200, 201), (s, b)
    upd_id = json.loads(b)[0]["id"]
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d"
        "49444154789c63600100000005000150fd2fb40000000049454e44ae426082"
    )
    path = f"{pid}/{upd_id}/pixel.png"
    s, b, _ = req(
        "POST",
        f"/storage/v1/object/project-photos/{path}",
        token=SRK,
        body=png,
        headers={"Content-Type": "image/png"},
    )
    assert s in (200, 201), (s, b)
    s, b, _ = admin(
        "POST",
        "/rest/v1/update_photos",
        body={"update_id": upd_id, "storage_path": path, "sort_order": 0},
        headers={"Prefer": "return=representation"},
    )
    assert s in (200, 201), (s, b)
    return {"project_id": pid, "phase_id": phase_id, "update_id": upd_id, "path": path}


def signin(email):
    s, b, _ = req(
        "POST",
        "/auth/v1/token?grant_type=password",
        body={"email": email, "password": PASS},
    )
    assert s == 200, (s, b)
    return json.loads(b)


results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS" if ok else "FAIL"), "-", name, f"({detail})" if detail else "")


def isolated(status, body):
    """Either 200 with empty list, or denied with 401/403/404."""
    if status == 200:
        try:
            return json.loads(body) == []
        except Exception:
            return False
    return status in (401, 403, 404)


def main():
    stamp = int(time.time())
    email_a = f"rls-a-{stamp}@example.invalid"
    email_b = f"rls-b-{stamp}@example.invalid"
    uid_a = uid_b = None
    try:
        uid_a = create_user(email_a)
        uid_b = create_user(email_b)
        A = seed(uid_a, "AaaCar")
        B = seed(uid_b, "BeeCar")

        sess_b = signin(email_b)
        tok_b = sess_b["access_token"]

        # sanity: B sees own project (as authenticated user, RLS applies)
        s, b, _ = req(
            "GET",
            f"/rest/v1/projects?id=eq.{B['project_id']}&select=id",
            token=tok_b,
        )
        check("Sanity: B sees own project", s == 200 and len(json.loads(b)) == 1, f"status={s}")

        # isolation reads — all performed as authenticated user B
        for label, path in [
            ("A's project", f"/rest/v1/projects?id=eq.{A['project_id']}&select=id"),
            ("A's phases", f"/rest/v1/project_phases?project_id=eq.{A['project_id']}&select=id"),
            ("A's updates", f"/rest/v1/phase_updates?phase_id=eq.{A['phase_id']}&select=id"),
            ("A's photos", f"/rest/v1/update_photos?update_id=eq.{A['update_id']}&select=id"),
        ]:
            s, b, _ = req("GET", path, token=tok_b)
            check(f"B blocked from {label}", isolated(s, b), f"status={s}")

        # storage isolation — as user B
        s, b, _ = req(
            "GET",
            f"/storage/v1/object/project-photos/{A['path']}",
            token=tok_b,
        )
        check("B denied direct GET on A's photo", s in (400, 401, 403, 404), f"status={s}")
        s, b, _ = req(
            "POST",
            f"/storage/v1/object/sign/project-photos/{A['path']}",
            token=tok_b,
            body={"expiresIn": 60},
        )
        check("B denied signed URL on A's photo", s in (400, 401, 403, 404), f"status={s}")

        # sanity: B CAN sign own photo
        s, b, _ = req(
            "POST",
            f"/storage/v1/object/sign/project-photos/{B['path']}",
            token=tok_b,
            body={"expiresIn": 60},
        )
        check("Sanity: B can sign own photo", s == 200, f"status={s}")

        # UI: non-admin redirected from /admin
        if os.environ.get("SKIP_UI") == "1":
            print("SKIP - UI redirect check (SKIP_UI=1)")
        else:
            try:
                from playwright.async_api import async_playwright
            except ImportError:
                check("Non-admin redirected from /admin", False, "playwright not installed")
            else:
                session_json = json.dumps(sess_b)

                async def ui():
                    async with async_playwright() as pw:
                        br = await pw.chromium.launch(headless=True)
                        ctx = await br.new_context(viewport={"width": 1280, "height": 1800})
                        page = await ctx.new_page()
                        await page.goto(f"{APP}/", wait_until="domcontentloaded")
                        await page.evaluate(
                            f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, {json.dumps(session_json)})"
                        )
                        await page.goto(f"{APP}/admin", wait_until="domcontentloaded")
                        for _ in range(60):
                            await page.wait_for_timeout(200)
                            u = page.url
                            if "/admin" not in u or "/portaal" in u:
                                break
                        final = page.url
                        await br.close()
                        return final

                final = asyncio.run(ui())
                check(
                    "Non-admin redirected from /admin to /portaal",
                    "/portaal" in final and "/admin" not in final.split("?")[0],
                    f"final={final}",
                )
    finally:
        for u in (uid_a, uid_b):
            if u:
                admin("DELETE", f"/auth/v1/admin/users/{u}")

    ok = sum(1 for _, o, _ in results if o)
    total = len(results)
    print(f"\n=== {ok}/{total} checks passed ===")
    sys.exit(0 if ok == total else 1)


if __name__ == "__main__":
    main()