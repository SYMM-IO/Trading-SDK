# SYMMIO Frontier CLI

An SDK-first perps terminal built with [Ink](https://github.com/vadimdemedes/ink). It drives
`@symmio/trading-core` directly—no browser, wagmi, or `@symmio/trading-react`—and is designed for keyboard use over a
local terminal, SSH, or tmux. Keyboard navigation is always available; mouse clicks also select tabs, menu rows, and
segmented options in terminals that support SGR mouse reporting.

The CLI follows the current workspace SDK across both supported products:

| Deployment | Solver | Trading model             | Product-specific features                                 |
| ---------- | ------ | ------------------------- | --------------------------------------------------------- |
| Arbitrum   | Enigma | Virtual-account isolation | grouped close, TP/SL, Pools and Inventory                 |
| Base       | Rasa   | `CUSTOM` cross-margin     | limit open/close, Binance market data, solver diagnostics |

Press `x` anywhere outside a form or overlay to switch production deployments. Press `e` to switch the complete SDK
profile between production and the canonical Arbitrum staging deployment at runtime. Entering staging selects Arbitrum
and suspends chain switching because no matching Base staging profile is configured. Unsupported features remain
visible as explicit capability states instead of failing after submission.

## What is included

- live markets and prices, searchable market selection, constraints, fees, caps, and exact spendable-margin sizing;
- market and limit opens/closes where the active solver supports them;
- optimistic-to-on-chain position reconciliation, partial/bulk/group close, add/remove margin, TP/SL, order
  cancellation, force-cancellation, and eligible force-close recovery;
- isolation-aware sub-accounts, deposits, allocation, withdrawals and cooldown finalization, plus session-key grant and
  revocation;
- trade, balance, and internal-transfer activity with pagination and filters;
- candles, depth/orderbook, funding, estimated-price, and solver-specific analytics;
- Pools/Inventory catalog, capacity, rewards, transactions, authenticated user views, and service diagnostics;
- gasless wallet/deposit policy, operational-fee allowance, safe settlement, request tracking, and ambiguous-submit
  recovery on configured deployments;
- a System screen showing the resolved contracts, endpoints, capabilities, streams, and live health probes.

The UI reflows below 100–118 columns and gives a clear minimum-width message below 80 columns.

## Install and run

The CLI is intentionally outside the root pnpm workspace, but tracks the workspace SDK through versionless `pnpm pack`
artifacts. On a fresh clone, install the root workspace dependencies first, then enter the standalone CLI:

```sh
pnpm install
cd showcase/cli
pnpm sdk:refresh
pnpm dev
```

`sdk:refresh` builds `packages/trading-core`, `packages/session-key`, and `packages/utils`, packs them into the ignored
`vendor/` directory, and installs this standalone app. After the first setup, run it again from `showcase/cli` whenever
SDK source changes. Requires Node 22+ and pnpm.

For a production build:

```sh
pnpm build
node dist/index.js
```

## Configuration

Public screens work without a wallet. Copy the template when you need an identity or custom endpoint:

```sh
cp .env.example .env
# Required on Unix before adding SYMMIO_PRIVATE_KEY:
chmod 600 .env
```

| Variable                                          | Purpose                                                                                |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `SYMMIO_CHAIN`                                    | Startup chain: `arbitrum` or `base`.                                                   |
| `SYMMIO_ENVIRONMENT`                              | Startup profile: set to `staging` for the canonical Arbitrum staging bundle.           |
| `SYMMIO_ARBITRUM_RPC_URL` / `SYMMIO_BASE_RPC_URL` | Per-chain RPC override.                                                                |
| `SYMMIO_RPC_URL`                                  | Shared RPC fallback.                                                                   |
| `SYMMIO_*_AFFILIATE_ADDRESS`                      | Optional registered affiliate override; per-chain values win.                          |
| `SYMMIO_PRIVATE_KEY`                              | Local signer for unattended writes; no external-wallet prompt. Use a low-value wallet. |
| `SYMMIO_ADDRESS`                                  | Read-only owner address when no signer is configured.                                  |
| `SYMMIO_WALLETCONNECT_PROJECT_ID`                 | Enables the `w` → WalletConnect QR flow.                                               |
| `SYMMIO_WALLETCONNECT_RELAY_URL`                  | Optional WalletConnect relay override.                                                 |
| `SYMMIO_KEYSTORE_DIR`                             | Session-key and request-journal directory; defaults to `.symmio`.                      |

Production Arbitrum and Base do not currently advertise a gasless service. The Gasless tab therefore explains that it
is unavailable instead of mixing staging services with production contracts. `SYMMIO_ENVIRONMENT=staging` applies the
full matching Arbitrum bundle. Eligible staging writes use its gasless relay by default; relay failure is surfaced as an
error rather than silently falling back to a direct wallet transaction. The same complete profile switch is available
while the CLI is running with `e`; its fresh query cache and socket tree prevent production data from carrying into the
staging view.

## Keyboard model

| Keys                          | Action                                                   |
| ----------------------------- | -------------------------------------------------------- |
| `1`–`9` / `tab` / `shift+tab` | Select or cycle screens when no overlay is open.         |
| `↑` `↓` / `j` `k`             | Move through lists and forms.                            |
| `←` `→` / `h` `l`             | Change segmented values and numeric steps.               |
| `enter`                       | Open, preview, confirm, or submit the focused action.    |
| `/`                           | Search where offered.                                    |
| `c` / `g` / `m` / `t`         | Close, group-close, margin, or TP/SL on a position.      |
| `a` / `C`                     | Manage a pending order / close all actionable positions. |
| `x`                           | Switch production deployment when no overlay is open.    |
| `e`                           | Switch Production ↔ Arbitrum Staging at runtime.         |
| `w` / `?` / `q`               | Open wallet, open help, or quit when no overlay is open. |
| `esc`                         | Close the active overlay.                                |

Inline hints and the status bar reflect the current screen or overlay. Text entry suspends global single-key shortcuts.
While an overlay is open it owns keyboard input: `esc` closes it, and the global `q`, `w`, `?`, `x`, and tab-navigation
shortcuts are intentionally suspended.

Mouse support uses the terminal's alternate screen, so the CLI restores the previous shell contents when it exits.
Inside tmux, enable mouse forwarding with `set -g mouse on`. Terminal text selection while mouse reporting is active is
usually available by holding `shift`, though the exact modifier depends on the terminal emulator.

A focused text field owns printable characters, including shortcut letters. Use `↑`/`↓` to leave the field; `j`/`k`
only navigate when no text field is focused. The Gasless screen reserves `[`/`]` for section navigation even while a
field is focused. Its footer collapses to the controls that are actually active, and view-specific actions are shown
beside the panel that owns them.

## Signing and safety

The main wallet signs owner-authorized contract writes. With `SYMMIO_PRIVATE_KEY`, signing happens locally and a write is
broadcast after the CLI's own confirmation without an external-wallet approval prompt. A locally generated session key
signs trading operations after the wallet grants the chain-correct selector set. On Rasa `CUSTOM` accounts the CLI
skips the VA-only margin selector when checking readiness; on Enigma it requires the complete VA lifecycle. Delegations
never outlive the local session key, and every delegated write performs a fresh on-chain readiness check before signing.
New sub-accounts use the active solver's compatible isolation model automatically.

Normal collateral deposits approve only the entered amount, then wait for that receipt before depositing. Gasless
operational-fee allowance is a separate, explicitly entered budget. Destructive bulk/group actions require a review and
explicit confirmation.

`.env`, `.symmio/`, build output, dependencies, and packed SDK tarballs are gitignored. Gitignore is not access control:
on Unix, any `.env` file that defines `SYMMIO_PRIVATE_KEY` must have no group/world read bits (run `chmod 600 .env`); the
CLI refuses to load an exposed file. Windows does not expose equivalent POSIX mode bits, so keep the file in a
user-protected directory and restrict it with the account's ACLs.

The session-key keystore is an unencrypted hot signer at rest. It is created with mode `0600` and should be protected
like any credential file. Gasless request recovery persists only public request handles with mode `0600`; signatures
and replay bodies are never written or printed.

## Verify

```sh
pnpm check-types
pnpm lint
pnpm build
```

For a render smoke test, run `pnpm dev` in an 80-column and a wide terminal. Network/service errors are rendered in the
screen and must not crash the process.

See [AGENTS.md](AGENTS.md) for implementation conventions.
