# SAPE Education Fair CRM

TanStack Start CRM deployed on Cloudflare Workers and connected to Convex.

## Local Development

Create `.env.local` from `.env.example` and set your Convex deployment URL:

```txt
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
```

Run the app and Convex watcher:

```bash
npm run dev
npx convex dev
```

## Cloudflare Workers

Build and preview the Worker output:

```bash
npm run cf:preview
```

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

Set `VITE_CONVEX_URL` in the Cloudflare build/deploy environment before deploying.
