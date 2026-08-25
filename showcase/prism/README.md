# Prism

**One app. Every perp.** A multi-solver perpetuals DEX built entirely on the
SYMMIO SDK — majors and lowcaps in one book, one ticket, one keystroke.

Prism exists to answer one question: _what does the SDK actually let you build?_
It merges two independent SYMMIO deployments that live on different chains,
speak to different solvers, price off different oracles and settle on different
systems — and presents them as a single trading surface.

|                 | Majors                                | Lowcaps                                |
| --------------- | ------------------------------------- | -------------------------------------- |
| Solver          | `rasa`                                | `enigma`                               |
| Chain           | Base (8453)                           | HyperEVM (999)                         |
| Prices          | Binance USD-M futures                 | Enigma lowcap price service            |
| Margin          | Cross-margin on the sub-account       | Virtual Accounts, per market + side    |
| Funded with     | deposit **and allocate**              | plain deposit — allocating breaks it   |
| Spendable pot   | allocated balance, minus a 10% buffer | available balance, minus fees          |
| Instant open    | 1 signed op, live Muon attestation    | 2 signed ops, placeholder + flexFields |
| Limit orders    | supported                             | not supported                          |
| TP/SL           | not supported                         | supported                              |
| Group close     | not supported                         | supported                              |
| Pre-trade quote | accepted price band                   | estimated fill for a size              |
| Extra gates     | solver readiness, account whitelist   | per-market `state` and allowed side    |
| Palette         | Cyan                                  | Magenta                                |

The interface never changes shape between them — only its palette.

**Nothing in the app branches on a solver id to decide any of that.** Every row
above is answered at runtime: `useSupportsLimitOrder`, `useTpSlSupported`,
`supportsEstimatedPrice`, the `kind` discriminant on markets and notional caps,
and — for the margin model — the **sub-account's isolation type**, which is the
one the SDK is emphatic about. Assuming a Virtual Account on Base because it is
"the majors chain" is the most common majors-integration bug; Prism reads
`SubAccountIsolationType.CUSTOM` instead, so a cross-margin account on HyperEVM
(which the test wallet actually has) is handled correctly too.

## Running it

```bash
pnpm install
pnpm dev
```

A clean dev server settles at ~1.5 GB and stays flat with both price sockets
live. If it ever dies with a V8 heap OOM, it is Turbopack accumulating across
recompiles after heavy editing, not a leak in the app — `rm -rf .next` and
restart.

Prism is **not** a member of the SYMM-Frontier pnpm workspace: it carries its
own empty `pnpm-workspace.yaml` so `pnpm install` treats this folder as its own
root.

### Dependency source — read this before `pnpm install`

Prism always runs against the **latest build of `packages/*` in this repo**,
installed from tarballs vendored in `vendor/`, not from npm:

```json
"@symmio/trading-core":  "file:./vendor/symmio-trading-core.tgz",
"@symmio/trading-react": "file:./vendor/symmio-trading-react.tgz",
"@symmio/utils":         "file:./vendor/symmio-utils.tgz"
```

The filenames carry **no version**, so refreshing the SDK never means editing
`package.json` — repack over the same three paths and `pnpm install`.

All three also appear in `pnpm.overrides`, pointing at the same tarballs.
`pnpm pack` rewrites each `workspace:^` dependency to a semver range
(`trading-react` → `@symmio/trading-core@^1.1.0`, `trading-core` →
`@symmio/utils@^1.0.0`), and without the overrides pnpm satisfies those ranges
from npm — silently installing a stale `@symmio/utils` **underneath** the fresh
`trading-core` while the top-level `@symmio/utils` still resolves to the vendored
one.

**Why not npm.** The published `@symmio/*@1.1.0` carries the same version number
as the packages in this repo but a much older build (last published 2026-07-26).
It predates the entire multi-solver surface Prism is built on: no
`SymmioSolverKind`, no `SolverId`, no `Market` union, no `watchPrices`, no
orderbook, candles, TP/SL, Muon, margin, `rasa-solver` or quote reconciliation.
The app cannot compile against it.

**Why not `link:` to `../../packages`.** It works for `tsc`, but the symlinks
point outside this folder, so the bundler root has to be the monorepo — and then
Turbopack walks every app and package in it and exhausts memory before it
finishes compiling.

Vendored tarballs are also the honest setup: they are byte-for-byte what
`pnpm publish` would upload, extracted into this project's own `node_modules`
exactly as a third-party consumer would receive them.

**Refreshing the SDK** after changing `packages/*` — build, repack, reinstall:

```bash
pnpm sdk:refresh
```

Run it whenever `packages/*` moves. The SDK is a moving target and the repack is
not automatic, so a stale `vendor/` is the first thing to suspect when Prism
fails to compile against an API you know exists. Breaking changes surface as
type errors — fix Prism to the new API rather than pinning back to the old
tarball.

## Deploying

```bash
./deploy.sh              # production
./deploy.sh --preview    # preview URL
./deploy.sh --refresh-sdk
```

Prism deploys to Vercel from a laptop, not from a git push. There is no CI
pipeline and no git integration on the Vercel project, by design: the SDK
dependencies are the vendored tarballs described above, and those are ignored by
the repo's root `.gitignore` (`*.tgz`). A Vercel build started from a clone would
find `file:./vendor/*.tgz` missing and fail at install.

`deploy.sh` inverts the order instead. It builds the app **locally** with
`vercel build` — where `vendor/` exists — and then ships only the resulting
`.vercel/output` with `vercel deploy --prebuilt`. Vercel runs no install of its
own, so the tarballs never need to leave this machine. What is deployed is
whatever `vendor/` held at build time, which makes `--refresh-sdk` the way to
publish a demo that picks up new `packages/*` work.

Authenticate and link the project once, from this directory:

```bash
pnpm dlx vercel login
pnpm dlx vercel link      # writes ./.vercel/project.json, gitignored
```

The Vercel CLI is invoked through `pnpm dlx`, so it is a tool rather than a
dependency of the app. Set `VERCEL_TOKEN` to skip the interactive login,
`VERCEL_SCOPE` when the account belongs to more than one team, and
`VERCEL_CLI_VERSION` to pin the CLI.

Two things the script guards for you. It refuses to run while port 1122 is
listening, because a live `pnpm dev` shares `.next` with the build and the two
corrupt each other. And it warns when the local Node major is newer than
Vercel's newest runtime (22.x) — `vercel pull` takes the runtime from the
project settings, so set **Node.js Version → 22.x** in the Vercel project if a
deploy ever rejects the build output.

Prism reads no environment variables. Both chains use public RPCs pinned in
[`src/config/wagmi.ts`](src/config/wagmi.ts), and the only wallet connector is
`injected()`, so a deployed instance needs no configuration at all — though
public RPC rate limits are worth keeping in mind for a demo that several people
open at once.

## How the multi-solver part works

Everything hangs off one table, [`src/config/deployments.ts`](src/config/deployments.ts):

```ts
export const DEPLOYMENTS = [
  { family: "majors",  chainId: BASE,      solverId: "rasa",   tone: "mj", … },
  { family: "lowcaps", chainId: HYPER_EVM, solverId: "enigma", tone: "lc", … },
];
```

Three mechanisms turn that table into a merged app:

1. **Fetches** fan out through
   [`useDeploymentQueries`](src/features/data/use-deployment-queries.ts), which
   feeds the SDK's core `getXQueryOptions(config, { chainId, solverId })`
   factories into a single `useQueries`. A hook cannot be called in a loop; the
   query-options factories can. Results never collide in cache because every SDK
   query key already carries `chainId`, `solverId` and a hash of the resolved
   chain config.
2. **Sockets** fan out through one subscriber _component_ per deployment —
   see [`PriceProvider`](src/features/prices/price-provider.tsx). Components can
   be mapped where hooks cannot.
3. **Reads need no chain switching.** `SymmioProvider` bridges `getClient` to
   wagmi's per-chain transports, so both chains are readable wherever the wallet
   sits. Writes still switch to the target chain first — and the app says so.

Adding a third market family means adding a row to that table.

A deployment that fails is reported and contributes no rows; one solver being
down never blanks the other's data.

## The trade screen

### A workspace, not a document

From `xl` up the trade screen is one `dvh`-bounded grid whose regions scroll
inside themselves. The chart height and the order-book width are the only free
variables — both dragged by the user, both persisted — and the clamping lives in
the CSS template (`.prism-trade-grid` in `globals.css`), not in the drag handler,
so a window resize re-solves it too and the blotter can never be squeezed to
nothing. The ladder measures its own row height and shows exactly as many levels
as fit. Below `xl` the same panels stack and the page scrolls normally.

The drag writes the CSS variable straight onto the grid element inside a
`requestAnimationFrame` and hands the value back to React once, on release —
a `pointermove` fires far more often than a paint, and every cell in this grid
holds live SDK subscriptions.

### One ladder of gates

The ticket shows exactly one call to action at a time, in the order the user has
to satisfy them:

```
connect → switch chain → create an account → register with the solver
        → authorise trading → deposit collateral → place the order
```

Each rung names the remedy for its own state. The three that are easy to get
wrong:

- **A known ceiling, not a rendered zero.** `availableMargin` reads `"0"` while
  the balance loads, when it errors, and when the account is empty. Only
  `availableMarginWei !== undefined` separates them, so submit is blocked until
  the ceiling is a fact.
- **Every market limit, before the wallet prompt.**
  `validateInstantOpenAgainstMarket` turns `lotSize`, `minAcceptableQuoteValue`,
  `minAcceptablePortionLf`, the notional bounds and the live cap into named
  violations. Nothing in `prepareInstantOpenParams` does this for you.
- **The protocol's liquidation price.** `calculateLiquidationPrice` over the
  position this order would create — not `entry ± entry / leverage`, which
  ignores CVA, LF and the account balance entirely.

### Signing without a popup

Orders are signed by a **session key** held in this browser, not by the wallet.
`SymmioProvider` receives a `getWalletClient` resolver
([`use-prism-wallet-client.ts`](src/features/session-key/use-prism-wallet-client.ts))
that returns the session-key client when a write's `from` matches it and the
connected wallet otherwise — so an order signs locally while a deposit or the
delegation grant itself still goes through the wallet, as it must.

The key is persisted encrypted in `localStorage`. That is not a detail: a key
held only in memory is re-minted on every reload, which drops every delegation
granted to the old one.

The sub-account must delegate to that key before it can sign, and the contract
checks the delegation **at execution time** — after the solver has already
accepted the request — so a missing grant fails silently, on-chain, once the
spinner has stopped. `useTradingDelegation` probes each selector and gates every
session-key write on it: the ticket, the blotter's Close, and the cancel actions
alike. The required set is per-isolation, because a cross-margin account never
calls `addMarginToNextVA` and requiring that selector would deadlock it.

Portfolio shows the key in its session-key strip and each account's grant on its
ledger row, where the chip that reads `Authorise` is also the button that fixes it.

## Design

Prism ships the **Prism Design System** — a Dracula-based dark palette with a
three-tier token architecture in [`src/app/globals.css`](src/app/globals.css).
Components reference tier-3 tokens only, which is what makes the global mode
switch a re-tint rather than a redesign.

Three identities: **platform** purple for chrome and CTAs, **cyan** for majors,
**magenta** for lowcaps. Direction (green long, red short), risk and lifecycle
colors are immune to the mode — a trader reading green must know it means long,
not "majors".
