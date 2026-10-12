# Instant-open migration handoff

Status: SDK changes and the migration are applied to the original v2 app. Matching local SDK packages are installed, and the app manifest and lockfile are updated.
Date: 2026-10-10.

## Applied workspace

App: `/Users/alit/Job/SYMM/Vibe/v2-vibe-ui/Vibe-ui-v2`.
The app was clean at commit `14a8810b6bf82d9a3811c6573455a93a6a15fd8a` before applying.
The prepared patch passed `git apply --check` and was applied successfully.
No additional workspace access or design approval is needed.

## Prepared work

- [App patch](./app.patch): 70 files against app commit
  `14a8810b6bf82d9a3811c6573455a93a6a15fd8a`.
- [Manifest](./manifest.json): changed paths and SHA-256 checksums.
- Isolated app copy: `/private/tmp/symmio-instant-open-app-4woikmxx`.
- Local built packages: `vendor/sdk/symmio-trading-core-3.2.0.tgz` and
  `vendor/sdk/symmio-trading-react-3.2.0.tgz` beside this file.
  These are local development snapshots, **not published 3.2.0 packages**.
  Tarballs are ignored by Git; rebuild them from the SDK checkout if absent.
- [Approved plan and implementation notes](../../vibe-v2-instant-open-sdk-migration.md).

The patch was applied to a separate base-file copy and every resulting file was
compared byte for byte against the prepared app. The original app was clean and
unchanged when the patch was created. Recheck before applying; do not overwrite
newer work if the app has moved since then.

## Reproducing the applied dependency update

The following was applied from the app repository. Do not reapply the source patch to the already migrated checkout:

```sh
git apply --check /Users/alit/Job/SYMM/SYMM-Frontier/migration-artifacts/instant-open-sdk/app.patch
git apply /Users/alit/Job/SYMM/SYMM-Frontier/migration-artifacts/instant-open-sdk/app.patch
mkdir -p vendor/sdk
cp /Users/alit/Job/SYMM/SYMM-Frontier/migration-artifacts/instant-open-sdk/vendor/sdk/*.tgz vendor/sdk/
bun --config=bunfig.unfrozen.toml add @symmio/trading-core@file:vendor/sdk/symmio-trading-core-3.2.0.tgz @symmio/trading-react@file:vendor/sdk/symmio-trading-react-3.2.0.tgz
```

**Dependency update completed.** The normal Bun add initially tried to fetch registry
manifests, which this sandbox cannot access. The two local package resolutions were
seeded from the existing lock entries after verifying their dependency and peer ranges
are identical, using SHA-512 checksums calculated from the tarballs. A frozen install
succeeded in the isolated copy, then the required Bun add completed in the original app
and rewrote its lockfile. All other dependency resolutions remained unchanged.
Installed SDK files were compared byte for byte to both tarballs (3,168 core files and
1,188 React files). The app's ignore rules explicitly allow these two snapshots so
manifest, lockfile and packages can travel together.

To rebuild local tarballs, run from the SDK repository:

```sh
pnpm --filter @symmio/trading-core --filter @symmio/trading-react build
pnpm --dir packages/trading-core pack --pack-destination ../../migration-artifacts/instant-open-sdk/vendor/sdk
pnpm --dir packages/trading-react pack --pack-destination ../../migration-artifacts/instant-open-sdk/vendor/sdk
```

For a production release, publish the SDK through the normal approved release
process and update the app to that released version instead of retaining local
snapshot dependencies. No publishing was requested or performed here.

## Delivered behavior

- Main form prepares and sends instant opens through SDK hooks and the existing
  session signer. Deployment mapping includes solver, price service and contracts.
- Entered USD amount includes opening fees. Max preserves raw 18-decimal balance.
- Available shows full deposited, unallocated balance; failed reads retain the last
  successful value, and initial unavailable balance stays unknown.
- SDK owns funding, quantity, price bounds, fees, freshness, signing and rejection
  handling. It checks fresh available funds before automatic submission.
- The app's old open submission, signing helpers, funding math and preview hook
  are removed. The hidden dock can no longer open trades; close behavior remains.
- Acceptance remains pending until confirmation. Post-attempt and live open/failure
  events refresh displayed balance; polling, notifications and TP/SL remain.

## Validation completed

| Check                                     | Result                                                         |
| ----------------------------------------- | -------------------------------------------------------------- |
| Core full suite                           | 474 files, 3,372 tests passed                                  |
| React full suite                          | 204 files, 882 tests passed                                    |
| Core, React and SDK docs type checks      | Passed                                                         |
| Core, React and SDK docs lint             | Passed                                                         |
| Core and React production builds          | Passed                                                         |
| `pnpm verify-pack`                        | Passed: packed exports, publint and attw                       |
| App focused suite                         | 43 files, 453 tests passed                                     |
| App typecheck                             | Passed                                                         |
| App guardrails, boundaries, docs and i18n | Passed; existing debt retained, removed stale entries          |
| App touched-file ESLint                   | No errors; existing unrelated unused-parameter warnings remain |
| App patch application                     | Applied to original app after checking unchanged base          |

App tests cover exact Max, partial budgets, signing, rejected attempts, retained
balance after RPC failure, open/failure refreshes, live notifications arriving
before HTTP, close behavior and TP/SL recovery. SDK tests cover budget sizing,
price/funding bases, static fees/caps, separate deadlines, stale estimates,
insufficient funds, malformed acceptance and negative temporary IDs.

## Original-app verification after installation

- Focused tests: 43 files / 453 tests passed.
- Guardrails, boundaries, docs and i18n: passed.
- Touched-file ESLint: passed with zero errors and nine existing warnings.
- Typecheck: passed.
- Frozen dependency installation in the original app: passed.
- SDK runtime smoke: all three instant-open hooks import successfully, and the app and
  React SDK resolve the same installed core package.
- Production build: `SENTRY_AUTH_TOKEN= NODE_OPTIONS=--max-old-space-size=4096 bun run build --webpack`
  passed (exit 0), including TypeScript and all 95 static pages. Source-map uploads were
  disabled for this local validation. Warnings concern optional wallet-package imports
  (`@farcaster/mini-app-solana`, `@metamask/connect-evm`, `accounts`) and an expression-based
  dependency in `ox`.
- The default Turbopack build remained at compilation and was interrupted (exit 130).
  This does not establish a cause for the stall; default-compiler verification remains open.

## Remaining checks

- Complete the default Turbopack build if that compiler is required for deployment.
  The alternate webpack production build passed.
- Complete SDK docs production build: blocked by Google Fonts network access.
- Complete the published-package consumer smoke phase of `pnpm verify-packages`:
  dependency downloads were blocked by sandbox networking. Layer 1 passed separately.
- Browser validation and a live trading smoke test were not performed. Do not send
  real trades without explicit authorization.

Source changes and matching dependencies are now in the original app and ready for review.
The source-only `app.patch` and its manifest retain the original prepared snapshot; the
app checkout additionally contains dependency pins, local tarballs and updated installation docs.
