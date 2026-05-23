# 🤖 Project Memory & Context Index
> **CRITICAL RULE FOR THE AI:** Read this file FIRST before touching any code or files. This is your onboarding map. Do not load the other `.md` files in this directory unless your specific task requires them.

## 📂 Context Directory Map

| File Name | What it Contains | WHEN YOU SHOULD READ IT |
| :--- | :--- | :--- |
| `README.md` | This index and onboarding rules. | **Always read first** on a new session. |
| `completed_features.md` | A historical log of what is 100% built and working. | Read *only* if you are debugging an existing feature or checking how a past feature was implemented. |
| `future_roadmap.md` | A structured backlog of what to build next. | Read *only* when the user says "What's next?" or asks you to build a new feature. |
| `architecture_map.md` | The visual folder tree and app data flow. | Read *only* if you are creating new routes, folders, or changing how data moves. |
| `secrets_manifest.md` | Tracking map for environment variables. | Read *only* when setting up a new API key, OAuth, or backend service. |

## 📜 Global AI Execution Rules
1. **Never guess:** If the current code state doesn't match `completed_features.md`, stop and ask the user for clarification.
2. **Update on Completion:** When you finish a task, you are responsible for updating the relevant specific file (e.g., moving a task from roadmap to completed).
3. **Protect Secrets:** Never hardcode actual API strings. Check `secrets_manifest.md` for variable naming conventions.

---

**Project:** Student Calling CRM
**Stack:** TanStack Start v1 + React 19 + Vite 7 + Tailwind v4 + shadcn/ui + Supabase (Lovable Cloud) on Cloudflare Workers
