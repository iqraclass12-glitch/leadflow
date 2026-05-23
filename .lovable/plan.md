# SAPE Education Fair — Full Rebrand & Simplification

This is a large, partially destructive change. Confirming the plan before touching the database.

## 1. Rebrand to "SAPE Education Fair"

- `index.html` title + meta
- Root route `head()` (sitewide title/og:site_name)
- Login page heading
- Sidebar header in `_authenticated.tsx`
- Dashboard page title
- Admin panel title

## 2. Database migration (destructive — drops columns)

`leads` table is reduced to:
`id, name, phone, status, notes, assigned_to, created_by, created_at, updated_at`

SQL:
- `ALTER TABLE leads RENAME COLUMN student_name TO name`
- `ALTER TABLE leads DROP COLUMN gender, category, father_name, mother_name, school, district, angry_flag, callback_date, last_called_at, is_locked, locked_by, locked_at, first_contributor_id, first_contribution_at, latest_contributor_id, latest_contribution_at, total_contributors, updated_by`
- `ALTER TABLE leads ADD COLUMN created_by uuid`
- Drop `acquire_lead_lock`, `release_lead_lock`, `lc_rollup`, contribution rollup trigger (no longer needed since contributor columns are gone)
- Keep `lead_contributions` table (used for history) but stop the rollup trigger
- Update `leads_auto_contribution` trigger to drop callback/assignment logic
- Tighten RLS: managers can only `SELECT` leads where `assigned_to = auth.uid()`; admins see all. Only admins can `INSERT`/`DELETE`.
- Drop `whatsapp_messages` tracking if any; keep `whatsapp_settings` (template + one image).

## 3. Lead UI simplification

- `src/lib/leads.ts` — strip `Lead` type to new shape; remove lock helpers, contribution types stay (for history page only)
- `src/components/LeadDialog.tsx` — remove school/district/parents/category/gender/lock UI; show Name, Phone, Status, Notes, contribution timeline
- `src/routes/_authenticated/leads.tsx` — table shows Name, Phone, Status, Notes, Last Updated. Add bulk-delete for admin only. Managers see only `assigned_to = me`.
- `src/routes/_authenticated/import.tsx` — CSV import accepts only `Name` and `Number` columns; ignore extras; admin-only route guard.

## 4. Role-based access

- Add route guard in `_authenticated.tsx` (or per-route) redirecting managers away from `/admin` and `/import`.
- Sidebar hides Admin/Import for managers.
- WhatsApp page available to both, but admin doesn't get analytics.

## 5. WhatsApp simplification

- `buildWhatsAppUrl` in `src/lib/leads.ts`: stop appending the image URL to the message text. Keep image upload (admin sets one image in `whatsapp_settings`) — but it's only shown in the manager's WhatsApp settings UI, not embedded in the deep link.
- Remove any WhatsApp tracking from `activity_log` / admin analytics. (No `whatsapp_messages` table exists; just ensure nothing logs WA sends.)

## 6. Admin panel redesign (`/admin`)

New simplified sections:
1. **Manager List** — name, email, role selector, suspend toggle
2. **Lead Management** — table of all leads with bulk delete + reassign
3. **Manager History** — per-manager activity (calls / status updates / notes only). NO WhatsApp.
4. **CSV Upload** — link to /import
5. **Template Management** — link to /whatsapp template editor

Charts: contributions/day, contributions/manager (filtered to `lead_created`, `status_updated`, `note_added` only — no whatsapp types exist anyway).

## 7. Dashboard fix (`/dashboard`)

Rewrite with accurate counts:
- Total leads, my assigned leads, leads by status (pie), recent activity
- Pull from `leads` + `lead_contributions`
- No "WhatsApp sent" KPI

## 8. History page (`/history`)

Per-manager (or own, for managers) table: Lead Name, Phone, Action, Date, Time. Filter by manager (admin only).

## 9. Out of scope

- Microsoft Phone Link integration — `tel:` links already work on both mobile & desktop; no extra code needed
- Backfilling historical contribution data
- Splitting WhatsApp settings into a separate route

## Technical notes

- The `Lead` type change cascades into `LeadDialog`, `leads.tsx`, `dashboard.tsx`, `history.tsx`, `import.tsx`, `whatsapp.tsx`. All will be rewritten.
- `src/integrations/supabase/types.ts` regenerates automatically after migration.
- Existing data: column drops are irreversible. Existing leads keep their `name` (was `student_name`) and `phone`; other fields are lost.

After you approve, I'll run the migration first, then rewrite the frontend in one pass.
