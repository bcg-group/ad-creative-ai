# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # start dev server (Turbopack, outputs to .next/dev)
npm run build     # production build (also Turbopack by default)
npm run start     # start production server
npm run lint      # run ESLint directly (next lint was removed in v16)
```

## Architecture

Next.js 16 App Router with TypeScript and Tailwind CSS v4. The app generates AI ad creatives using the Anthropic SDK.

- `app/layout.tsx` — root layout with Geist fonts and full-height flex body
- `app/page.tsx` — home page (Server Component by default)
- `app/api/generate/route.ts` — POST route handler that calls Claude (`claude-sonnet-4-5`) to generate ad headlines; reads `ANTHROPIC_API_KEY` from env

Tailwind v4 uses `@import "tailwindcss"` and `@theme inline { ... }` in `globals.css` instead of a `tailwind.config.js`.

## Next.js 16 Breaking Changes

These differ significantly from earlier versions:

**Async-only Request APIs** — `cookies()`, `headers()`, `draftMode()`, route `params`, and page `searchParams` are now Promises. Always `await` them:
```ts
const cookieStore = await cookies()
const { id } = await params
```

**`middleware` → `proxy`** — rename `middleware.ts` to `proxy.ts` and the exported function to `proxy`. The `edge` runtime is not supported in `proxy`; use `nodejs` runtime only.

**`revalidateTag` requires a second arg** (cacheLife profile): `revalidateTag('tag', 'max')`. For immediate refresh use `updateTag` in Server Actions instead.

**PPR** — use `cacheComponents: true` in `next.config.ts` instead of `experimental.ppr`.

**Parallel routes** — all `@slot` directories require an explicit `default.js` file or builds fail.

**Removed**: `next lint` CLI command, `serverRuntimeConfig`/`publicRuntimeConfig`, AMP support, `next/legacy/image`, `experimental.dynamicIO` (replaced by `cacheComponents`).

**`next build` no longer runs linting** — run `npm run lint` separately.

**Environment variables**: only `NEXT_PUBLIC_*` vars are available in the client bundle. Server-only vars are accessed in Server Components or Route Handlers.
