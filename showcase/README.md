# showcase

Standalone example apps built on the SYMMIO SDK, kept **outside** the SYMM
Frontier monorepo workspace on purpose. Each folder here:

- depends on the `@symmio/*` packages as a third-party consumer would — from
  npm (`telegram`, pinned `^0.2.0`) or from vendored `pnpm pack` tarballs
  (`cli`, `prism`) — never on `workspace:*`;
- carries its own `pnpm-workspace.yaml` so `pnpm install` treats it as its own
  root instead of joining the monorepo workspace;
- has app-specific install and refresh commands documented in its README.

They exist to show third-party developers how to consume the SDK end-to-end in
different runtimes — not as workspace members the monorepo builds.

| App                    | What it is                                         | SDK surface                                                          |
| ---------------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| [`telegram`](telegram) | Perps DEX as a Telegram Mini App (Next.js webview) | `@symmio/trading-react` + `@symmio/trading-core`                     |
| [`cli`](cli)           | Perps DEX in the Linux terminal (Ink)              | `@symmio/trading-core` **directly** — headless, no React web / wagmi |
| [`prism`](prism)       | Multi-solver perps DEX (Next.js)                   | `@symmio/trading-react` + `@symmio/trading-core` + `@symmio/utils`   |

> **Note:** `telegram` tracks SDK APIs released in `@symmio/*@0.2.0`. `cli` and
> `prism` exercise the **latest build of `packages/*`** through version-less
> tarballs in their ignored `vendor/` directories; refresh either app with
> `pnpm sdk:refresh`. See each app's README to run it.
