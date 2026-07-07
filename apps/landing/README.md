# @symmio/landing

The marketing landing page for the SYMM Frontier workspace — the front door that
introduces the SDK (`@symmio/trading-core`, `@symmio/trading-react`, and the
supporting libraries) and the apps built on it (the web console, the docs site,
and Storybook).

It is a purely presentational Next.js app: no wallet, no SDK runtime, no data
client. The hero's trading panel is a live-_looking_ mock; every outbound link
points at a deployed surface (see `src/lib/site.ts`).

## Stack

Mirrors `apps/web` so the two surfaces read as one product:

- Next.js (App Router) · React · Tailwind v4
- Design tokens and primitives from `@symmio/ui` ("Voltage Graphite" theme)
- `next-themes` for light/dark
- `motion` for orchestrated entrance and scroll-reveal animations

## Develop

```bash
pnpm --filter @symmio/landing dev
```

## Notes

- Base colors, fonts, and the atmosphere are inherited from `@symmio/ui` — the
  palette is identical to the console by construction, not by duplication.
- Update `src/lib/site.ts` if the deployed hosts for the console, docs, or
  Storybook change.
