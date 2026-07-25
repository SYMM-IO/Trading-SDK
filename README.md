<div align="center">

# SYMMIO Trading-SDK

**The frontend boundary between UI and SYMMIO.**

An SDK-first workspace: the libraries that make SYMMIO buildable, and the apps that prove they are.

[![CI](https://github.com/SYMM-IO/Trading-SDK/actions/workflows/ci.yml/badge.svg)](https://github.com/SYMM-IO/Trading-SDK/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-5FA04E?logo=node.js&logoColor=white)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](pnpm-workspace.yaml)
[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?logo=turborepo&logoColor=white)](turbo.json)

[**Website**](https://trading-sdk.symm.io/) · [**Documentation**](https://doc.trading-sdk.symm.io/) · [**SDK console**](https://console.trading-sdk.symm.io/) · [**Contributing**](AGENTS.md)

</div>

---

SYMMIO is a hybrid clearing house for permissionless derivatives. The product behind it is built by many vendors with different architectures: contracts, solvers, subgraphs, oracles, price feeds, and notification services. Building a UI directly against that raw surface means learning all of it.

This repo exists so you don't have to. It ships an SDK that hides the complexity behind an API that is **simple, correct, and reliable** — plus the apps we build on top of it, which are the proof that the SDK is good enough to build real products with.

> Looking for **how to use** the SDK? Everything — install, config, and every action, hook, and type — lives on the [documentation site](https://doc.trading-sdk.symm.io/).

## Packages

Two SDK layers, and a strict rule about what goes where: `trading-core` never imports a framework, so a framework layer can be added without rewriting it.

| Package                                           |                                                      Version                                                      | Description                                                                                                                                                                                                    |
| ------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@symmio/trading-core`](packages/trading-core)   |  [![npm](https://img.shields.io/npm/v/@symmio/trading-core)](https://www.npmjs.com/package/@symmio/trading-core)  | Framework-agnostic SDK. Contract reads/writes via viem, solver REST, subgraph GraphQL, Muon attestations, price and notification streams, and the calculations that turn raw protocol data into typed results. |
| [`@symmio/trading-react`](packages/trading-react) | [![npm](https://img.shields.io/npm/v/@symmio/trading-react)](https://www.npmjs.com/package/@symmio/trading-react) | React adapter. A hook and a provider for everything in `core`, with caching and invalidation wired through TanStack Query and wagmi.                                                                           |
| [`@symmio/utils`](packages/utils)                 |         [![npm](https://img.shields.io/npm/v/@symmio/utils)](https://www.npmjs.com/package/@symmio/utils)         | Framework-agnostic helpers: amount formatting, address shortening, a Decimal.js bridge.                                                                                                                        |
| [`@symmio/session-key`](packages/session-key)     |   [![npm](https://img.shields.io/npm/v/@symmio/session-key)](https://www.npmjs.com/package/@symmio/session-key)   | Local EVM session keys — generate, persist through an injected storage interface, and sign without a wallet prompt.                                                                                            |

Not part of the SDK surface — SDK consumers never need these:

| Package                                                   |                                                          Version                                                          | Description                                    |
| --------------------------------------------------------- | :-----------------------------------------------------------------------------------------------------------------------: | ---------------------------------------------- |
| [`@symmio/ui`](packages/ui)                               |                                                         _private_                                                         | Design system and primitives for our own apps. |
| [`@symmio/eslint-config`](packages/eslint-config)         |     [![npm](https://img.shields.io/npm/v/@symmio/eslint-config)](https://www.npmjs.com/package/@symmio/eslint-config)     | Shared ESLint flat configs.                    |
| [`@symmio/typescript-config`](packages/typescript-config) | [![npm](https://img.shields.io/npm/v/@symmio/typescript-config)](https://www.npmjs.com/package/@symmio/typescript-config) | Shared TypeScript configs.                     |

**Chain support:** HyperEVM mainnet (`999`) is the only chain that ships today. The plumbing is chain-keyed throughout, so adding one is a registry entry rather than a refactor.

## Development

If you want to build a product on top of the SDK, read the [documentation](https://doc.trading-sdk.symm.io/) — and especially the [Build a Perps DEX guide](https://doc.trading-sdk.symm.io/guides/build-a-dex/) — to learn the flow of building a trading product: how to deposit, open a trade, set TP/SL, withdraw, and more.

The three integration facts humans and AI agents most often get wrong — affiliate defaults, the available-balance model, and the two decimal scales — are called out at the top of that guide: **[Three facts integrators get wrong most often](https://doc.trading-sdk.symm.io/guides/build-a-dex/#three-facts-integrators-get-wrong-most-often)**.

Requires **Node ≥ 20** and **pnpm** (the version in `packageManager`; `corepack enable` picks it up). This repo is pnpm-only — `npm install` or `yarn` here will produce a broken tree.

```sh
pnpm install
pnpm dev          # every app, via Turborepo
```

All commands run from the repo root and fan out through Turborepo:

| Command                | What it does                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `pnpm dev`             | Run every app's dev server (and the packages' watch builds).                                      |
| `pnpm build`           | Build everything in dependency order.                                                             |
| `pnpm lint`            | ESLint, zero-warnings.                                                                            |
| `pnpm check-types`     | `tsc --noEmit` across the workspace.                                                              |
| `pnpm test`            | Unit tests (Vitest). Integration tests stay gated behind `SYMM_RUN_INTEGRATION` and a funded key. |
| `pnpm format`          | Prettier.                                                                                         |
| `pnpm verify-packages` | Verify the _published_ shape of the packages — see below.                                         |

Scope any of them to one package with `pnpm --filter @symmio/trading-core test`, or run it from that package's directory.

Lefthook runs Prettier, ESLint, and type-checks pre-commit, and commitlint on the message — commits follow [Conventional Commits](https://www.conventionalcommits.org/).

### Verifying published output

`pnpm lint` and `pnpm check-types` only ever exercise workspace symlinks under bundler resolution, so they cannot catch a broken subpath export, an unresolvable `.d.ts`, or a file missing from the tarball. `pnpm verify-packages` packs each package, lints the tarball with [publint](https://publint.dev) and [`@arethetypeswrong/cli`](https://arethetypeswrong.github.io), then installs it into a consumer _outside_ the workspace and type-checks it under strict `nodenext` before importing it at runtime. CI runs this on every PR.

### Releasing

Versioning is [Changesets](https://github.com/changesets/changesets)-driven. Add one with `pnpm changeset` in any PR that changes a published package; merging to `main` opens or refreshes the "Version Packages" PR, and merging _that_ publishes to npm.

## Contributing

Read [`AGENTS.md`](AGENTS.md) first — it is the contract for this repo, for humans and AI coding agents alike, and it covers the hard rules (pnpm only, TypeScript only, `core` stays framework-agnostic), the file and naming conventions, and the **Design Proposal Gate**: non-trivial changes to `trading-core` or `trading-react` get a written design proposal and explicit approval before any implementation code is written. Several packages add their own `AGENTS.md` that applies on top of the root one.

Keep increments small and reviewable — one SDK slice per PR.

## License

[MIT](LICENSE) © SYMMIO
