# PR #85 review feedback resolution

Reviewed 2026-10-31. Scope: incremental changes after `3ca868894cc33bc5692d5e180ea644f317056a03` on `feature/VIBE-1899/sdk-tpsl`. Existing unrelated local review notes were preserved. This is the feedback-fix review, not a replacement for the earlier full SDK review.

## Second comment — unsupported TP/SL order type

[Comment 6543788019](https://github.com/SYMM-IO/Trading-SDK/pull/85#issuecomment-6543788019) is valid. The shared leg builder defaulted to market (`1`), while the handler rejects market TP/SL. Changed the default to the existing `OrderType.MARKET_BEST_EFFORT` (`2`). Both standalone set/edit and instant-open attachment use this builder. Explicit overrides, zero-value absent-leg sentinels, mark/last trigger selection and opening order types are preserved.

Evidence: the reference frontend's `lib/trading/vibecaps/cohV5.ts` at the approved app baseline uses `orderType: 2`; [perps-core v0.8.6 close-to-liquidation documentation](https://github.com/SYMM-IO/perps-core/blob/version_0.8.6/docs/v0.8.6/pages/close-to-liquidation.html) defines value 2 as close-only and rejects it for opening. New transport fixtures reproduce the reported rejection before the fix and accept TP-only, SL-only and both afterward. These are contract fixtures, not live backend execution evidence.

Committed first as `3d2cd0a5`.

## First comment — reference app acceptance and recovery

[Comment 6543764589](https://github.com/SYMM-IO/Trading-SDK/pull/85#issuecomment-6543764589) is valid about the missing consumer wiring. The reference app now:

- Selects prepared quantity and passes the deployment chain explicitly.
- Labels HTTP acceptance separately from activation, preserving the accepted open when attachment fails.
- Offers manual **Retry TP/SL only** for explicit `SET_TPSL_REJECTED` with resolved parameters. The button calls `useSetQuoteTpSl` with that exact parameter object; it cannot rerun the open.
- Treats other outcomes conservatively as unconfirmed; a malformed/transport result does not enable a blind retry. A missing identifier does not fabricate recovery parameters.
- Prevents duplicate recovery clicks and starting a new open while recovery is in flight.
- Remounts the form on wallet, connection, account, session, deployment or solver changes, removing obsolete recovery controls.
- Waits for the predicted VA and quantity instead of silently dropping requested TP/SL when those inputs are unavailable.

The reference app intentionally uses `tpslState: "sdk"`. It already uses SDK-owned state; switching to `external` without an application reconciler would remove that owner. Documentation explains when external mode is appropriate. Existing SDK notification/read confirmation behavior and the separate application PR are unchanged.

An explicit rejection describes this request's acceptance outcome; it does not prove that no older TP/SL exists. An empty read also cannot establish that an ambiguous in-flight write will never complete. The recovery UI makes neither claim and does not introduce backend correlation or idempotency guarantees.

## Verification and self-review

| Check                                       | Result                                                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Core TP/SL tests                            | 267 passed across 24 files                                                                                                              |
| React TP/SL + instant-open attachment tests | 155 passed across 14 files                                                                                                              |
| Reference app tests                         | 26 passed across 3 files: rendered status, mounted button, exact recovery inputs, duplicate guards, unknown outcomes and context resets |
| Core typecheck and lint                     | Passed                                                                                                                                  |
| Reference app typecheck and lint            | Passed                                                                                                                                  |
| SDK production builds                       | Passed through `verify-packages`                                                                                                        |
| Packed packages                             | All package checks, independent NodeNext consumer typecheck and runtime entrypoint imports passed                                       |
| Reference app production build              | Passed with temporary `turbopack.root` set to the SDK checkout; original config restored                                                |
| Frozen offline installation                 | Passed; only approved app test dependencies added to the lockfile; existing runtime resolutions retained                                |

The ordinary app build inferred the outer application's Bun root and imported its instrumentation, failing on an unrelated module. The isolated build used this checkout as root and passed; no main-checkout files or watchers were changed. SDK output was not rebuilt during application checks.

Reviewed the complete incremental diff for signed payload changes, absent-leg compatibility, prepared sizing, accepted-open preservation, retry ambiguity, duplicate writes, context reset, SDK/app ownership, package scope and documentation. Resolved the synchronous recovery/new-open race found during review. No remaining actionable finding in this increment.

Test dependencies were explicitly approved by the user and reuse versions already resolved elsewhere in the workspace: Vitest 4.1.10, Testing Library React 16.3.2 / DOM 10.4.1 and happy-dom 16.8.1. No new runtime dependency or SDK public API was added.

## QA and release limits

Automated tests use synthetic transports and mocked SDK hook boundaries; no live signing/trading or settlement was performed. Browser visual verification is not claimed. To verify manually: open with TP only, SL only and both; inspect each nonempty signed leg for `orderType: 2`; verify acceptance is not presented as active protection; simulate an explicit attachment rejection and confirm recovery submits only attachment; simulate a lost/malformed response and verify retry is absent; switch signing contexts and verify old recovery controls disappear.

The PR remains draft. Merge/publication and published-consumer verification remain separate release gates. Backend mutation IDs/order versions, replay and durable retry idempotency remain outside this fix.
