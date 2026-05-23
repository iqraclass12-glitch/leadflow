# Completed Features Log
> **AI GOVERNANCE RULE:** This file is READ-ONLY for future AI sessions regarding historical context. New entries must only be appended upon 100% feature completion and verification.

## 📜 System Rules for AI
1. When a feature passes local verification, remove it from `future_roadmap.md` and append it here.
2. Include the implementation date, core files modified, and verification steps.

---

## 🛠️ Implemented Features & Core Stack

### Core Stack (initial scan)
- **Framework:** TanStack Start v1 (React 19, SSR, file-based routing in `src/routes/`)
- **Build:** Vite 7 + Cloudflare Vite plugin (deploys to Cloudflare Workers via `wrangler.jsonc`)
- **Styling:** Tailwind CSS v4 (`src/styles.css`) + shadcn/ui (Radix primitives) + `lucide-react` icons
- **State / Data:** TanStack Query v5, TanStack Table v8, React Hook Form + Zod
- **Backend:** Supabase (Lovable Cloud) — Auth, Postgres + RLS, Realtime, Storage
- **Server logic:** `createServerFn` + `requireSupabaseAuth` middleware; admin operations via `supabaseAdmin`

### Feature Modules (implemented)
- **Auth & Roles:** Supabase auth, `user_roles` table with `app_role` enum (`admin`, `manager`), `has_role()` security-definer function. Login at `/login`, `_authenticated` layout guard.
- **Dashboard** (`/dashboard`): aggregate lead stats + dark mode toggle.
- **Leads** (`/leads`):
  - Responsive desktop table + mobile cards
  - Search modes: All / Name / Number
  - School multi-select filter + "hide completed schools" toggle
  - Status set: New, Interested, Not Interested, Joined, Callback, Angry, Wrong Number, Not Picking Up, Switch Off
  - 10-minute realtime call lock (`acquire_lead_lock` / `release_lead_lock` RPCs) with cross-device broadcast
  - Deduplication by `name + normalized phone`
  - Manual Refresh button
  - WhatsApp send button (uses admin-configured template + media)
- **Lead Dialog:** edit lead, add notes, Contribution Timeline (realtime).
- **Import** (`/import`): Google Sheet import via `sheet-import.functions.ts`.
- **History** (`/history`): per-manager activity feed + stat cards + filters; admins can scope by manager.
- **Admin** (`/admin`): manager analytics, role management, suspend toggle (admin-only).
- **WhatsApp** (`/whatsapp`): admin-only template + media manager, stored in `whatsapp_settings` + `whatsapp-media` storage bucket.
- **Contribution tracking:** `lead_contributions` immutable audit log with rollup triggers on `leads` (first/latest contributor, total contributors).

### Verification
- Builds clean under `vite build`; auth-protected routes only reachable under `_authenticated` layout.
