# @symmio/trading-core

Framework-agnostic SYMMIO SDK.

This package wraps SYMMIO contract calls behind a small, typed API built on [viem](https://viem.sh). It has no framework dependencies — `@symmio/trading-react` (and future Vue / Solid layers) sit on top of it.

## Status

Early. This first slice ships the `AccountLayer` domain (v0.8.5) on HyperEVM with two methods:

- `getUserSubAccounts(publicClient, params)` — list a user's subaccounts.
- `editAccountName(walletClient, params)` — rename a subaccount.

## Install

```sh
pnpm add @symmio/trading-core viem
```

`viem` is a peer dependency.

## Usage

### Free functions

```ts
import { createPublicClient, createWalletClient, http, custom } from "viem";
import { hyperevm } from "viem/chains";
import { getUserSubAccounts, editAccountName } from "@symmio/trading-core";

const publicClient = createPublicClient({ chain: hyperevm, transport: http() });

const subs = await getUserSubAccounts(publicClient, {
  user: "0xabc...",
  limit: 100n,
});

const walletClient = createWalletClient({
  chain: hyperevm,
  transport: custom(window.ethereum),
});

const hash = await editAccountName(walletClient, {
  account: "0xsub...",
  name: "My Trading Account",
});
```

### viem actions

Attach SDK methods to a viem client via `.extend()`:

```ts
import { accountLayerReadActions, accountLayerWriteActions } from "@symmio/trading-core";

const reader = createPublicClient({ chain: hyperevm, transport: http() }).extend(accountLayerReadActions);

await reader.getUserSubAccounts({ user: "0xabc..." });
```

## Documentation

Full reference and concept docs: see `apps/docs` in the monorepo (or [the published docs site] once available).

## Contributing

See [`AGENTS.md`](./AGENTS.md) for package-specific rules and the repo-root [`AGENTS.md`](../../AGENTS.md) for monorepo conventions.
