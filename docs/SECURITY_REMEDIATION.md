# Security remediation runbook

Fixes for the vulnerabilities found in the September audit. Anything marked
**manual** cannot be done from this repository and must be performed in the
Supabase and Vercel dashboards.

---

## 1. Apply the database hardening (manual, do this first)

The application code is only safe once the permissive anon policies are gone.

Run `supabase/migrations/20261004000000_security_hardening.sql` in the Supabase
SQL editor. It:

- drops the ten `Allow anon all on ...` policies from
  `20260929000000_enable_dev_anon_access.sql`
- revokes all table/sequence/function privileges from the `anon` role
- forces new signups to `role = 'staff'`, ignoring attacker-supplied
  `user_metadata.role`
- adds `trg_guard_profile_privileges` so only an active manager can change
  `role`, `is_active`, or `email`
- restores the `profiles.id -> auth.users.id` foreign key and the `NOT NULL`
  constraints on `created_by` / `requested_by` / `recorded_by`
- re-creates every staff-facing RLS policy with a `fn_is_active_user()` check so
  a deactivated account's existing JWT stops working immediately

Verify afterwards:

```sql
SELECT policyname, tablename FROM pg_policies
WHERE policyname LIKE 'Allow anon%';   -- expect 0 rows

SELECT rolname, privilege_type FROM pg_tables
JOIN information_schema.role_table_grants ON ...
-- or simply confirm an unauthenticated REST call now returns 401/empty
```

## 2. Deploy the Edge Function (manual)

`supabase/functions/manage-staff/index.ts` owns staff credential lifecycle. It
needs the service-role key, which must never reach the browser.

```bash
supabase functions deploy manage-staff
```

Then set the function secret:

```bash
supabase secrets set ALLOWED_ORIGINS=https://your-app.vercel.app
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by Supabase
automatically. The function independently verifies the caller's JWT resolves to
an active manager profile before acting.

## 3. Rotate the anon key (manual)

The anon key was committed in `src/lib/supabase.js` and is in git history.

1. Supabase dashboard → Project Settings → API → **Reset anon key**
2. Update `VITE_SUPABASE_ANON_KEY` in Vercel → Settings → Environment Variables
3. Locally, update `.env`
4. Redeploy

Optional cleanup of history (rewrites commits, so coordinate first):

```bash
git filter-repo --path src/lib/supabase.js --invert-paths
```

## 4. Check CORS (manual)

Supabase → Authentication → URL Configuration → Site URL. Remove `*` from
allowed origins and list only your deployed domains.

## 5. Deploy

`vercel.json` now ships CSP, HSTS, `X-Content-Type-Options`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and
`Cross-Origin-Opener-Policy`. The Tailwind CDN script was replaced with the
build-time Tailwind v4 plugin, so no third-party JavaScript executes.

---

## What changed in the app

| Area | Before | After |
| --- | --- | --- |
| Login | Supabase, then silent fallback to hardcoded passwords | Supabase Auth only; demo path is dev-only and stripped from prod bundles |
| Signup | Accepted client-supplied `role` | Always `staff`; DB trigger also hardcodes `staff` |
| Staff passwords | Stored plaintext in `localStorage`, shown in `type="text"` | Never stored client-side; managed via Edge Function; masked inputs, 8-char minimum, `crypto.getRandomValues` for generation |
| Data scoping | `null` user was treated as a manager; staff received every profile | `null` returns nothing; staff receive only their own profile row |
| Driver name matching | `includes()`, so an empty name matched every delivery | Exact match, guarded against empty strings |
| Role checks | Client-side only | RLS + privilege-guard trigger; client checks are UX only |
| Uploads | Any type/size, base64 in row | MIME + extension allow-list, 1.5 MB cap, SVG excluded |
| Session teardown | Session keys only | Full local cache wipe via `dataStore.clearLocalCache()` |
| Authority source | `approveAdvance` accepted a role-bearing notes object | `currentUser` only |
| Console output | 30+ `console.warn/error` in production | Dev-only via `src/lib/logger.js` |

## Remaining known limitations

- **No rate limiting on login.** Supabase applies its own limits, but add a
  rate limiter or CAPTCHA before exposing this publicly.
- **Password reset is manager-driven.** There is no self-service
  `resetPasswordForEmail` flow for staff.
- **RLS alone does not stop a leaked anon key from reading allowed rows.** It
  stops writes and cross-tenant reads, which was the critical exposure here.
- **`profiles` is still fetched wholesale for managers**, which is intended.
  Staff now receive only their own row.