/**
 * 4-byte selector of `GaslessWallet.execute((address,uint256,bytes)[])` — the
 * only selector a relayed wallet operation's `callData` may start with.
 *
 * @example
 * ```ts
 * const isWalletOperation = operation.callData.slice(0, 10).toLowerCase() === GASLESS_WALLET_EXECUTE_SELECTOR;
 * ```
 */
export const GASLESS_WALLET_EXECUTE_SELECTOR = "0x3f707e6b" as const;

/**
 * Sentinel selector (`bytes4(keccak256("GASLESSQ_WALLET_EXECUTION"))`) a
 * session key must hold an InstantLayer delegation for before it may sign
 * **delegated** GaslessWallet executions — alongside every inner call selector.
 * Owner-signed wallet operations do not use it. The GaslessLayer exposes the
 * same value as `WALLET_EXECUTION_SENTINEL_SELECTOR()`.
 *
 * @example
 * ```ts
 * const selectors = [GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR, ...innerSelectors];
 * ```
 */
export const GASLESS_WALLET_EXECUTION_SENTINEL_SELECTOR = "0x1dccecab" as const;

/**
 * The longest a signature made by an SDK gasless call stays valid: 20 minutes,
 * counted from the moment the call starts. Every SDK call that signs a gasless
 * operation fixes the deadline when it starts, so an attempt started at `T`
 * (seconds) can no longer execute once the chain's latest block timestamp
 * passes `T + GASLESS_SIGNATURE_LIFETIME_SECONDS`. Allow a minute of margin for
 * the time between recording `T` and making the call.
 *
 * Gasless-wallet operations (`gaslessWalletExecute`) use a shorter lifetime, so
 * this bound covers them too.
 *
 * @example
 * ```ts
 * const settledAt = lastAttemptStartedAtSeconds + GASLESS_SIGNATURE_LIFETIME_SECONDS + 60;
 * if (latestBlock.timestamp > BigInt(settledAt)) await reconcile(action);
 * ```
 */
export const GASLESS_SIGNATURE_LIFETIME_SECONDS = 20 * 60;
