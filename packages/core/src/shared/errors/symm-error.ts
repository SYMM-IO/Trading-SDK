/**
 * Base error class for SDK-level failures (configuration, registry lookups, etc.).
 *
 * On-chain failures surface as viem errors (`ContractFunctionExecutionError`,
 * `CallExecutionError`, ...) and are not wrapped — consumers handle them with
 * viem's own error hierarchy.
 */
export class SymmError extends Error {
  override readonly name = "SymmError";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
