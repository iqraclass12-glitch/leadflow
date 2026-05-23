# Architecture Map & Data Flow
> **AI GOVERNANCE RULE:** Update this map immediately whenever you introduce new directories, permanent page routes, API endpoints, or database tables.

## 📜 System Rules for AI
1. Maintain the visual file tree below to match the physical repository structure exactly.
2. Document high-level data flow changes when new infrastructure elements are added.

---

## 📂 Directory Tree

```
.
├── .ai_context/                  # Project memory & governance (this folder)
│   ├── README.md
│   ├── completed_features.md
│   ├── future_roadmap.md
│   ├── architecture_map.md
│   └── secrets_manifest.md
├── .lovable/
│   └── plan.md                   # Active implementation plan
├── src/
│   ├── routes/                   # TanStack Start file-based routes
│   │   ├── __root.tsx            # Root shell (html/head/body, providers)
│   │   ├── index.tsx             # "/"
│   │   ├── login.tsx             # "/login"
│   │   ├── _authenticated.tsx    # Auth-guarded layout (Outlet)
│   │   └── _authenticated/
│   │       ├── dashboard.tsx     # "/dashboard"
│   │       ├── leads.tsx         # "/leads"
│   │       ├── import.tsx        # "/import"
│   │       ├── history.tsx       # "/history"
│   │       ├── admin.tsx         # "/admin" (admin-only)
│   │       └── whatsapp.tsx      # "/whatsapp" (admin-only)
│   ├── components/
│   │   ├── LeadDialog.tsx
│   │   ├── ContributionTimeline.tsx
│   │   └── ui/                   # shadcn/ui primitives
│   ├── hooks/
│   │   ├── use-auth.tsx
│   │   ├── use-theme.tsx
│   │   └── use-mobile.tsx
│   ├── lib/
│   │   ├── leads.ts              # Lead types + client helpers + lock TTL
│   │   ├── admin.functions.ts    # Admin serverFns (role mgmt, analytics)
│   │   ├── sheet-import.functions.ts  # Google Sheet import serverFn
│   │   ├── error-capture.ts
│   │   ├── error-page.ts
│   │   └── utils.ts
│   ├── integrations/supabase/
│   │   ├── client.ts             # Browser client (publishable key, RLS)
│   │   ├── client.server.ts      # supabaseAdmin (service role, server only)
│   │   ├── auth-middleware.ts    # requireSupabaseAuth
│   │   ├── auth-attacher.ts      # functionMiddleware → attach bearer token
│   │   └── types.ts              # Generated DB types
│   ├── router.tsx
│   ├── server.ts
│   ├── start.ts
│   ├── styles.css                # Tailwind v4 tokens (oklch)
│   └── routeTree.gen.ts          # AUTO-GENERATED — do not edit
├── supabase/
│   ├── config.toml
│   └── migrations/               # SQL migrations (roles, contributions, locks, whatsapp)
├── package.json
├── vite.config.ts
├── wrangler.jsonc                # Cloudflare Workers deploy config
└── tsconfig.json
```

---

## 🔄 Data Flow Overview

1. **Client → Server Functions:** UI calls `createServerFn` handlers via `useServerFn`. `attachSupabaseAuth` global function middleware injects the user's Supabase bearer token; `requireSupabaseAuth` validates it and provides a user-scoped `supabase` client (RLS enforced).
2. **Direct browser → Supabase:** Auth flows, Realtime subscriptions (lead locks, contributions, history), and Storage reads use the browser `supabase` client.
3. **Admin / privileged ops:** Server-only routes/functions use `supabaseAdmin` (service role) — bypasses RLS; gated by `has_role(uid, 'admin')`.
4. **Audit trail:** Mutations on `leads` / `lead_notes` fire DB triggers → append to immutable `lead_contributions` → rollup updates `leads.first_contributor_id` / `latest_contributor_id` / `total_contributors`.
5. **Realtime:** Supabase channels broadcast `lead_contributions` inserts and lead-lock state to all connected managers.

## 🗄️ Key Database Tables
- `leads`, `lead_notes`, `lead_contributions`
- `user_roles` (+ `app_role` enum), `profiles`
- `lead_locks` (10-minute calling lock)
- `whatsapp_settings` (singleton template + media URLs)
- Storage bucket: `whatsapp-media` (public read, admin write)
