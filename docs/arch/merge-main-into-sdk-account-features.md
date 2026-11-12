# Merge resolution plan: main into feat/sdk-account-features

## Merge state

- Current branch: `feat/sdk-account-features`, starting at `abd56475`.
- Incoming branch: freshly fetched `origin/main` at `45557b4c`.
- The merge has started without a commit. Its two conflicts have been resolved using the approach below.
- The user approved these resolutions. Validation is in progress.
- The fetch used a temporary HTTPS remote override through the existing local proxy.

## Saved configuration loading

File: `apps/web/src/features/config/symmio-overrides-store.tsx`.

The account-features branch restores the staging deployment's timelock capability when loading older saved configuration. Main migrates the retired staging price-stream endpoint and persists that migration. Both changes replace the same hydration statement.

Preserve both transformations. First migrate the price configuration, then rebase the gasless deployment facts, then restore the staging timelock capability. Store the combined result in React state. When the price migration changes the saved configuration, persist the fully rebased result, preserving main's persistence condition.

```ts
if (stored !== undefined) {
  const migrated = migratePriceServiceOverrides(stored);
  const rebased = rebaseStagingTimelockCapability(rebaseGaslessDeploymentFacts(migrated));
  setOverridesState(rebased);
  if (migrated !== stored) writeStored(rebased);
}
```

Keep the existing timelock rebase in the configuration setter as well. Choosing either branch wholesale would lose either the price migration or the protection capability restoration.

## Trade-form setup

File: `apps/web/src/features/integration/open-position-step.tsx`.

The account-features branch adds an optional timelock context and checks protection readiness before trading. Main splits the component into a wallet-aware wrapper and a form keyed by signing context, so changing the deployment, wallet, subaccount, session key, or solver discards stale mutation results and recovery controls. Both changes replace the component's initial setup.

Keep main's `OpenPositionStep` wrapper, its wallet/chain guard, and its signing-context key. Forward all props into the keyed `OpenPositionForm`. Move the branch's timelock setup into that form and retain main's chain-aware default-solver lookup:

```ts
function OpenPositionForm({ subAccount, sessionKey, solverId, timelockContext, idPrefix = "instant-open" }: Props) {
  const config = useSymmioConfig();
  const chainId = useSymmioChainId();
  const resolvedSolverId = solverId ?? config.getDefaultSolverId(chainId);
  const localTimelock = useTimelockContext(subAccount, resolvedSolverId);
  const timelock = timelockContext ?? localTimelock;
  // Keep the remaining merged form body.
}
```

Keep the optional `timelockContext` prop, readiness gating, and protected-write inputs from the account-features branch. Preserve main's automatically merged price-preview and TP/SL recovery changes.

## SDK and documentation impact

Both manual resolutions are app composition. They introduce no SDK exports or signature changes and require no new public API reference pages. Keep the SDK code and public documentation brought in by the automatic merge, including both branches' existing feature documentation.

## Validation after resolution

- Confirm no unresolved index entries or conflict markers remain.
- Run Prettier on the two resolved files and this plan.
- Run `pnpm lint` and `pnpm check-types` for the merged workspace.
- Run the existing unit suites for `@symmio/trading-core`, `@symmio/trading-react`, and `@symmio/web`.
- Check the existing mocked browser coverage for saved price configuration, signing-context changes, and timelock readiness where available.
- Review the final merge diff before creating a merge commit.
