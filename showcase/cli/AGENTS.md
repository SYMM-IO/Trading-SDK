# showcase/cli — Agent Guide

Rules for AI agents working in the terminal DEX. This is a **standalone SDK
consumer**, detached from the root pnpm workspace. It consumes versionless
`pnpm pack` artifacts from the current `packages/*` sources (via
`pnpm sdk:refresh`), not `workspace:*`, so it exercises the same package boundary
a third-party installation does without lagging behind unpublished SDK work.

## What this is

A full SYMMIO perps DEX rendered with **Ink** (React for the terminal) that
drives **`@symmio/trading-core` directly** — the SDK's framework-agnostic /
headless path. No wagmi, no `@symmio/trading-react`, no browser globals.

## Hard rules (in addition to the root)

1. **Core-direct only.** Import actions, types, enums, and chain config from
   `@symmio/trading-core`; session-key helpers from `@symmio/session-key`;
   formatting from `@symmio/utils`. Do **not** add `@symmio/trading-react` or
   `wagmi` — this app deliberately proves `core` works outside React web.
2. **One config.** `getConfig()` (`src/config/symmio.ts`) is the single
   `createConfig` instance. Reads use its public client; writes resolve through
   `walletHub.getWalletClient`. Never build ad-hoc clients in a screen.
3. **Reads via React-Query, per the SDK's shapes.** Wrap `getX(config, …)` in a
   hook under `src/sdk/`. Keep query keys stable; let the notification socket own
   position state (don't invalidate `managed-positions` on an instant open/close).
4. **Honor the invariants.** VA fan-out (`resolveQuoteAccounts` +
   `reconcileQuotes`), `tempQuoteId → quoteId` identity, WebSocket-authoritative
   close lifecycle (drive off `UnifiedQuote.lifecycle`, never `mutation.isSuccess`),
   Muon-signed `deallocate`/`removeMargin`, session-key delegation before instant
   trades, affiliate mandatory. These live in the SDK — compose, don't re-derive.
5. **Keys are hot.** The env private key and the session-key keystore are
   secrets. Keep `.env` and `.symmio/` gitignored; never log key material.
6. **Branch on account isolation, not chain names.** `CUSTOM` accounts trade
   cross-margin from allocated balance and have no VA; VA isolations trade from
   available balance. Gate optional flows through SDK capabilities.

## Conventions

- Kebab-case filenames; `function` keyword at module scope; `Props` for local
  prop types. Same as the rest of the repo.
- **Input gating.** Every `useInput` must gate on an `active` flag so screens,
  forms, and overlays never fight over a keystroke. Text fields set the global
  `textEditing` flag (via `useFormNav`) to suspend single-key shortcuts.
- **Theme.** Colors come from `src/config/theme.ts` (the "Ember" palette — the
  SYMMIO coral-on-warm-black brand, mirrored from `@symmio/ui`'s dark tokens).
  Don't hard-code hex in components.
- **Overlays** render in place of the active screen (`OverlayHost`); each owns
  its input and closes on success or `esc`.

## Verify

`tmux` renders an Ink app to plain text — use it to screenshot changes:

```sh
tmux new-session -d -s symm -x 132 -y 42
tmux send-keys -t symm "./node_modules/.bin/tsx src/index.tsx" Enter
# wait for data, then:
tmux capture-pane -t symm -p
tmux kill-session -t symm
```

Before declaring done, from this folder: `pnpm check-types`, `pnpm lint`, and
`pnpm build`, then drive the changed flow in a live session. Refresh packed SDK
artifacts first when the task changed a source package.
