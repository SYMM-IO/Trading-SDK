# Architecture: Absorbing Vendor Change

> **Status**: solver axis implemented (registry + `kind` + per-call selection); contract axis is a doctrine (one version per release), not code.
> **Scope**: `@symmio/trading-core` (with knock-on effects in `@symmio/trading-react`).

This document is the deeper companion to the `## Architecture` section of [`AGENTS.md`](./AGENTS.md), which describes the SDK's _present_ shape (immutable wagmi-style config, `fn(config, params)` actions, injected client resolvers). That shape is not changing. What this document addresses is a different question: **how the SDK absorbs change coming from the vendors underneath it.**

---

## 1. The problem

SYMMIO is not one system. It is contracts, solvers, oracles, price feeds, notification streams, and subgraphs — built by different teams, on different release cadences, with different (or absent) versioning policies. The SDK exists to hide that from application developers.

The SDK absorbs each kind of change through a different mechanism — and, deliberately, **not** every axis becomes config:

| Vendor surface | Handling                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------- |
| Contracts      | **One version per SDK release** — ABIs are direct imports; an upgrade is a new release (§2) |
| Solvers        | **Config-driven registry** — many per chain, selected per call, dispatched by `kind` (§3)   |
| Subgraph       | Unpinned Goldsky `/latest/gn` — versioning **deferred** (§6)                                |

Solver multiplicity is modelled as data because it is a _runtime_ fact — one app talks to several solvers at once. Contract version is **not** modelled as data because it is a _release-time_ fact — see §2 for why the registry alternative was rejected.

### 1.1 Three axes, three mechanisms

The axes look similar but differ in **binding time**, and that difference is what dictates three distinct mechanisms. Getting this wrong is the root of most bad designs in this space.

| Axis                 | Nature                                     | Bound at                         | Mechanism                              |
| -------------------- | ------------------------------------------ | -------------------------------- | -------------------------------------- |
| **Contract version** | Deployment version; breaking across majors | **Per SDK release** — pinned dep | One version per release (§2)           |
| **Solver**           | Runtime multiplicity + schema divergence   | **Per operation** — call time    | Solver registry + `kind` dispatch (§3) |
| **Subgraph**         | Tracks contracts, deploys independently    | Per chain                        | **Deferred** (§6)                      |

The load-bearing insight:

> An app interacts with **several solvers at once on the same chain**, but never with **two contract versions at once**.

Solver selection is therefore a property _of the individual call_ and must be a parameter. Contract version is a property _of the release_: the consumer picks it by pinning the SDK version, and the SDK carries exactly one set of ABIs. Putting solver selection in per-chain config — the pre-registry shape — made multi-solver structurally impossible; putting contract version in config would model a choice no running app actually makes.

---

## 2. Axis 1 — Contract version: one per release

### 2.1 Release-bound, not config-bound

Each release of `@symmio/trading-core` supports **exactly one** contracts version — today `v0.8.5`, whose ABI fragments live under `src/symmio-contracts/abi/v0.8.5/` and are imported directly by actions. The folder name is a **label** of the shipped version, not a selection axis: there is no version enum, no `protocolVersion` field in config, and no version-pack registry — deliberately.

Upgrading to a new contracts version is a **new SDK release**:

1. Swap the ABI fragments in place.
2. Let the compiler sweep. Every action type-checks its `args` tuple against the `as const` ABI via viem's call-site inference, so **every divergent signature surfaces as a compile error at exactly the call site that must change**. The upgrade diff _is_ the divergence report.
3. Fix the flagged sites, review the hand-listed sharp edges (§2.3, §2.4), bump major, release.

Consumers pick their contract version by **pinning the SDK version**. A chain still on the old contracts is served by the old SDK release line.

### 2.2 Why not a version registry — a deliberate rejection

An earlier revision of this document specified a version-pack registry: a `SymmioProtocolVersion` enum, a per-chain `protocolVersion` field, a `config.resolveVersionModule(chainId)` resolver, and per-version packs of ABIs + encoders + selectors + EIP-712 structs. It was dropped, for reasons worth recording:

- **The registry's only real payoff is serving two contract versions from one running app.** That scenario is speculative — vendors migrate a chain, apps follow with an SDK bump. Until one app must talk to two contract versions _simultaneously_, the registry is machinery without a customer, and every action pays its indirection.
- **Runtime ABI indirection breaks viem's call-site inference.** Resolving an ABI value from a registry forces either type erasure or a cast (`module.accountLayerAbi as typeof accountLayerAbi`) that asserts one version's types while another version's ABI executes. The compiler then validates `args` against the **wrong** signature, and the first divergent function yields a silently mis-encoded transaction that type-checks green. Direct `as const` imports keep the compiler checking every encoding — the exact property the registry design had to spend four defensive rules protecting.
- **Auto-detecting the on-chain version was rejected either way.** perps-core is an EIP-2535 Diamond with no `version()` view; probing `DiamondLoupe.facetAddress(selector)` is brittle and costs an RPC round-trip on a hot path. Version is a deployment fact the integrator already knows.

If the one-app-two-versions scenario ever becomes real, revisit: the seam to cut is the ABI import path, and the inference hazard above is the constraint any future design must answer first.

### 2.3 EIP-712 domain version is a separate axis — do not conflate it

[`eip712.ts`](./src/solvers/instant-open/shared/eip712.ts) hard-codes:

```ts
export const INSTANT_LAYER_EIP712_DOMAIN_NAME = "SymmioInstantLayer" as const;
export const INSTANT_LAYER_EIP712_DOMAIN_VERSION = "1" as const;
```

That `"1"` is the **InstantLayer contract's on-chain EIP-712 domain version**. It is orthogonal to `"v0.8.5"` and moves on its own schedule.

If the domain version were assumed to track the contracts version, a contracts upgrade that legitimately keeps domain version `"1"` would sign against the wrong domain — and **every signature would fail to verify**, with no local error to explain it. The domain name and version are therefore **explicit, independently-reviewed constants**: at a contracts upgrade (§2.1), verify them against the deployed contract instead of bumping them alongside the ABI label.

The same applies to `SIGNED_OPERATION_TYPES` in that file, whose own comment states the constraint plainly: it "mirrors the InstantLayer contract struct exactly — order, names, and solidity types here must match the contract or signatures will not verify."

### 2.4 Known sharp edge

Individual selectors are **derived** from the ABI, so they self-correct when a signature changes. But `INSTANT_TRADE_REQUIRED_SELECTORS` is a **hand-listed array**. A contracts version that adds a required selector will not be caught by the compiler sweep; a contracts upgrade requires a manual review of that set. Flagged here so it is a checklist item, not a surprise.

---

## 3. Axis 2 — Solvers

### 3.1 Identity and selection

Replace the single solver with a keyed registry plus a default, and make selection a per-call parameter:

```ts
solvers: Record<SolverId, SymmioSolverConfig>;
defaultSolverId: SolverId;
```

Every solver action gains `solverId?`, defaulting to `defaultSolverId`:

```ts
const solver = config.resolveSolver(parameters.chainId, parameters.solverId);
const markets = await getContractSymbols({ baseURL: solver.url });
```

This subsumes and replaces the inconsistent `baseUrl?` overrides currently on `get-instant-opens`, `get-instant-closes`, `get-instant-open-quote-id`, and `get-sub-account-quotes` — an escape hatch that existed only because there was no way to name a solver.

### 3.2 Open identity, closed schema — the key distinction

Two different things are being modelled, and they need different type treatments:

```ts
/** WHICH deployment. Open — integrators may register their own. */
export type SolverId = string;

/** WHAT API schema it speaks. Closed — drives typed dispatch. */
export type SymmioSolverKind = "enigma" | "rasa";
```

`id` answers _"which solver instance?"_ and must stay **open**, because integrators run their own solver deployments and the SDK cannot enumerate them. `kind` answers _"what shape is its API?"_ and must be **closed**, because the SDK ships a generated client per schema family and dispatch must be exhaustive.

Three deployments of Enigma's software are three `id`s with one `kind`.

There is **no solver API version axis** — same doctrine as contracts (§2): each SDK release ships one generated client per `kind`, tracking one API generation. When a solver ships a breaking API generation, the SDK regenerates that kind's client in a new release. If two generations of one kind ever had to be served _simultaneously_ (one deployment migrated, another lagging), the lagging shape would be modelled as its own `kind` — an explicit, temporary fork — rather than a `version` field in config.

### 3.3 Schema divergence via `kind`, not a capability `Set`

The requirement is that one solver may expose a method another lacks. The intuitive answer is a runtime capability set:

```ts
/** ⚠️ Rejected */
capabilities: Set<SolverCapability>;
```

This is rejected for two reasons:

- **It yields no compile-time narrowing.** Calling code still cannot know at build time that Rasa lacks a method; every call site degrades to a runtime check that is easy to forget.
- **It can drift.** A hand-maintained set in config can disagree with what the generated client actually contains, and nothing detects the divergence.

Instead, `kind` is a **discriminated union**, so a `switch` narrows to the correct generated client type and the compiler enforces exhaustiveness:

```ts
switch (solver.kind) {
  case "enigma":
    return enigma.getContractSymbols({ baseURL: solver.url });
  case "rasa":
    return rasa.listSymbols({ baseURL: solver.url });
  /** A new kind fails to compile here until it is handled. */
}
```

Where a `kind` genuinely cannot serve an action, it throws a typed `SymmError` (`UNSUPPORTED_BY_SOLVER`) rather than surfacing a vendor 404. (A derived capability table for UI gating was prototyped and then removed — the `kind` union plus per-action typed errors cover the need without a second surface to maintain.)

> **Open input.** The Rasa OpenAPI/Swagger URL is still needed. Enigma's is `https://solver.enigma.bz/api/swagger/doc.json` (see [`orval.config.ts`](./orval.config.ts)). Until Rasa's spec is supplied, the `"rasa"` branch is a structural placeholder — repo rules forbid inventing vendor endpoints, and designing the union against a guessed shape is exactly the mistake this section is meant to prevent.

### 3.4 Satellite infrastructure — per-solver override, chain-level fallback

`notifications`, `muon`, and `priceService` sit on `SymmioChainConfig` today, but physically they are **solver infrastructure** — the defaults point at `notification.rasa.capital`, `muon-oracle{1..4}.rasa.capital`, and Enigma's price service. With two solvers on one chain, a single chain-level value cannot be right for both.

The precedent already exists in the codebase: **`tpsl` is already nested under the solver** ([`chains/types.ts`](./src/core/chains/types.ts)). This design generalises that.

These become **optional per-solver overrides that fall back to chain-level defaults**:

```ts
const infra = solver.notifications ?? chainConfig.notifications;
```

This is deliberately a hybrid rather than a forced move. Some infrastructure genuinely is shared across solvers (a Muon oracle set), and some genuinely is not (a notification stream). Forcing everything under the solver would duplicate shared endpoints and invent a taxonomy that does not match reality.

The single-value unions `SymmioPriceServiceType = "enigma"` and `SymmioNotificationsProtocol = "defilytics"` are the widening seams for a second solver's protocol; adding members is non-breaking.

### 3.5 Query plumbing — the real hazard is `queryFn`, not `queryKey`

This is the most important implementation detail in the solver axis, and it is the opposite of what one would assume.

**Query keys are safe.** Every query factory — chain-scoped and solver-facing alike — folds the same `config.getChainConfigKey(chainId)` content hash. Solver isolation comes from the `solverId` field itself, spread from the options into the key:

```ts
queryKey: getMarketsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
// isolation: `solverId` rides in `...options`; freshness: the chain hash rotates on any override
```

and [`filterQueryOptions`](./src/shared/utils/query.ts) is a **blacklist** — it strips only `query`, `enabled`, `config`, functions, and `undefined`. So adding `solverId` to a `Parameters` type propagates into the cache key **automatically**, across all 11 factories. No manual work, no risk of a missed key.

**Query functions are the hazard.** Every `queryFn` enumerates its arguments explicitly:

```ts
queryFn: () => getMarkets(config, { chainId: options.chainId }),
/**                                  ^ solverId silently dropped */
```

Adding `solverId` to the parameters type therefore produces the **worst possible failure mode**: the cache key varies correctly by solver, so each solver gets its own cache entry and everything _looks_ right — but every entry is populated from the **default solver's** data. No error, no cache collision, no type error. Just wrong data attributed to the wrong solver.

**Mandate:** every one of the 11 solver query factories must have its `queryFn` argument list updated in the same change that introduces `solverId`. This is a correctness requirement, and it should be enforced by a test that asserts the `queryFn` forwards `solverId`, not left to review diligence.

### 3.6 Config merge needs per-key solver merging

[`mergeChainConfig`](./src/core/config/merge-chain-config.ts) merges a single fixed-shape `solver` via `mergeSolver`. A `Record<SolverId, SymmioSolverConfig>` needs **per-key merging**, so an integrator can override one solver's `url` without redeclaring every solver on the chain. `DeepPartial` over a `Record` does not give this for free — budget real work here, with tests for the partial-override case.

---

## 4. How the two axes compose

The two axes are **not** independent silos, and treating them as such is a design error worth naming.

`solvers/instant-open/shared/{calldata,eip712,selectors}.ts` import contract ABIs directly, yet they are invoked by **solver** actions. Encoding and EIP-712 domain construction are **compiled into the release** (§2); the URL and `partyB` address come from the **solver registry**. A single instant-open call touches both:

```ts
export async function instantOpen(config: Config, parameters: InstantOpenParameters) {
  const solver = config.getSolver({ chainId: parameters.chainId, solverId: parameters.solverId }); /** url + partyB */

  const callData = encodeSendQuote({ ...parameters, partyB: solver.address }); /** release-bound encoding */
  const domain = instantLayerDomain(chainConfig); /** release-bound EIP-712 domain */
  const signature = await signSignedOperation(operation, domain, walletClient);

  return dispatchBySolverKind(solver, { callData, signature });
}
```

Read this as the canonical shape: **the release decides _how_ to encode; the solver decides _where_ to send and _who_ is counterparty.** Any new action spanning both should follow it.

---

## 5. Config shape

As implemented in [`chains/types.ts`](./src/core/chains/types.ts) and [`create-config.ts`](./src/core/config/create-config.ts):

```ts
/** ---- Solver identity ---- */

/** Which solver deployment. Open — integrators may register their own. */
export type SolverId = string;

/** What API schema a solver speaks. Closed — drives exhaustive typed dispatch. */
export type SymmioSolverKind = "enigma";

export interface SymmioSolverConfig {
  /** Schema family; selects the generated client. (The registry key is the solver's id.) */
  kind: SymmioSolverKind;
  /** Human-readable name for UI. */
  name: string;
  /** Solver's on-chain address, used as `partyB`. */
  address: Address;
  /** Solver / hedger API base URL. */
  url: string;
  /** TP/SL handler — solver supports conditional orders only when set. */
  tpsl?: SymmioTpSlConfig;
}

/** ---- Chain config ---- */

export interface SymmioChainConfig {
  chainId: number;
  addresses: SymmioContractAddresses;
  subgraphs: SymmioSubgraphUrls;
  /** All solvers available on this chain, keyed by id. */
  solvers: Record<SolverId, SymmioSolverConfig>;
  /** Solver used when an action omits `solverId`. */
  defaultSolverId: SolverId;
  /** Chain-level infrastructure defaults (per-solver overrides may layer on later, §3.4). */
  priceService: SymmioPriceServiceConfig;
  notifications: SymmioNotificationsConfig;
  muon: SymmioMuonConfig;
}
```

Solver resolvers on `Config`, alongside the existing `getChainConfig` / `getChainConfigKey`:

```ts
export interface Config {
  /**
   * Resolve a solver's config, defaulting to the chain's `defaultSolverId`.
   * @throws {SymmError} `UNKNOWN_SOLVER` when the id is not configured.
   */
  getSolver(parameters?: { chainId?: number; solverId?: SolverId }): SymmioSolverConfig;
  /** Id of the chain's default solver. */
  getDefaultSolverId(chainId?: number): SolverId;
  /** Ids of every solver configured on a chain. */
  listSolverIds(chainId?: number): readonly SolverId[];
}
```

Two different cache-key kinds, on purpose:

- **Chain-scoped factories** fold `getChainConfigKey` — a **content hash** of the resolved chain config, so a runtime override rotates their keys.
- **Solver-facing factories** fold the SAME hash — no separate solver key function. Their isolation comes from the `solverId` option riding in the key (spread via `...options`), and the key + `queryFn` read the same `options.solverId`, so they cannot disagree. The trade-off is deliberate coarseness: overriding ONE solver's endpoints rotates every query key on that chain (siblings included). Accepted — config changes are rare and deliberate; serving stale data after an override is worse than an extra refetch.

---

## 6. Out of scope: subgraph versioning

Deliberately deferred, recorded here so the reasoning is not rediscovered.

The subgraph tracks the contract version conceptually, but versioning it today would be **half a solution**:

1. **Endpoints are unpinned.** The registry points at Goldsky `/latest/gn`. Pinning a document set against a floating schema guarantees nothing — the schema can drift underneath it. Real subgraph versioning requires version-pinned deployments first, which is a Goldsky-side operational change.

2. **Codegen routes by file path.** [`codegen.ts`](./codegen.ts) separates the analytics and events schemas **purely by glob** (`src/**` minus `src/transfers/**` for analytics; `src/transfers/**` for events), and both targets emit a `graphql` identifier. Moving query documents under version folders **breaks codegen** unless both globs are reworked — it will fail with confusing "cannot query field" errors against the wrong schema.

**Preconditions for revisiting:** version-pinned Goldsky endpoints, and a codegen router keyed on something other than file path.

Until then the existing raw escape hatch — `querySubgraph(config, { document, variables, subgraph })` — remains the supported way to handle schema skew, since it accepts an arbitrary document.

---

## 7. Status

| Work                                                                                                             | State    |
| ---------------------------------------------------------------------------------------------------------------- | -------- |
| Solver registry (`solvers` + `defaultSolverId`), per-call `solverId?`, `getSolver` / `listSolverIds`, kind guard | **Done** |
| Solver-facing query keys carry `solverId` + the chain configKey; `queryFn` arg lists forward `solverId` (§3.5)   | **Done** |
| Per-key solver merge in `mergeChainConfig` (§3.6)                                                                | **Done** |
| Rasa client: generate from Rasa's spec, add the `"rasa"` kind, implement dispatch                                | Pending  |
| React layer: thread `solverId` through the remaining hooks                                                       | Pending  |
| Per-solver satellite-infra overrides (§3.4)                                                                      | Pending  |

---

## 8. Summary of decisions

| #   | Decision                                                             | Rationale                                                                |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | **One contract version per SDK release** — no version registry       | Registry only pays off for one-app-two-versions, which does not occur    |
| 2   | ABIs stay direct `as const` imports                                  | Registry indirection breaks viem inference — green types, wrong encoding |
| 3   | Contract version is **not** auto-detected                            | Diamond has no `version()`; probing is brittle and costs an RPC          |
| 4   | EIP-712 domain version is **independent** of the contracts version   | Conflating silently invalidates every signature                          |
| 5   | Solver `id` **open**, solver `kind` **closed**                       | Integrators run their own deployments; the SDK ships a client per schema |
| 6   | **No solver API version axis** — one generation per kind per release | Same doctrine as contracts; a lagging generation becomes its own `kind`  |
| 7   | Divergence via `kind` union, **not** a capability `Set`              | A union narrows at compile time and cannot drift from the client         |
| 8   | One cache key fn: chain configKey hash + `solverId` as a key field   | `solverId` isolates solvers; the hash rotates on any override — no stale |
| 9   | Satellite infra: per-solver override, chain fallback (future)        | Some infra is genuinely shared, some genuinely is not                    |
| 10  | `queryFn` arg lists are the hazard, not query keys                   | Keys spread options; `queryFn`s enumerate them                           |
| 11  | Subgraph versioning **deferred**                                     | Unpinned endpoints + path-based codegen routing make it half a solution  |
