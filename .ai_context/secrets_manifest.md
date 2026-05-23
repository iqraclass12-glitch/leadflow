# Secrets Manifest & Environment Mapping
> **AI GOVERNANCE RULE:** **CRITICAL SECURITY RISK.** NEVER write actual production or local secret values (strings) in this file, any code files, or commit them to GitHub. This file tracks *where* keys are expected, not what they are.

## 📜 System Rules for AI
1. If an AI agent introduces an external API or service provider, it **must** register the required variable name below first.
2. Ensure environment files (like `.env`, `.env.local`, `.dev.vars`) are verified in the project's `.gitignore` before writing code for the feature.

---

## 🔑 Required Environment Variables

| Variable Name | Provider / Service | Environment / Scope | Purpose / Location Used |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase (Lovable Cloud) | Public / Browser (build-time) | Browser Supabase client — `src/integrations/supabase/client.ts` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase | Public / Browser (build-time) | Anon/publishable key for browser client (RLS enforced) |
| `VITE_SUPABASE_PROJECT_ID` | Supabase | Public / Browser (build-time) | Project identifier reference |
| `SUPABASE_URL` | Supabase | Private / Server (runtime) | Server-side Supabase client — server functions / SSR |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase | Private / Server (runtime) | Server-side user-scoped client (via `auth-middleware.ts`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | **Private / Server only** | `supabaseAdmin` in `client.server.ts` — bypasses RLS. NEVER expose to client. |

## 🛡️ Security Check Verification Status
- [x] `.env` is listed in `.gitignore`
- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY` if ever committed or shared
- [ ] All new secrets added via the Lovable secrets tool (not hardcoded)

## 📝 Conventions
- **Public/browser** vars: `VITE_*` prefix, read via `import.meta.env.VITE_*`.
- **Server-only** vars: no prefix, read via `process.env.*` **inside** `.handler()` of server functions (not at module scope).
- Never import `client.server.ts` from any file under `src/components/`, `src/hooks/`, or `src/routes/*.tsx` client code.
