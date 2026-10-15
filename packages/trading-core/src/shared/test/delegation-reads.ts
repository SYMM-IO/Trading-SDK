import { zeroAddress, type Address, type Hex } from "viem";
import type { Mock } from "vitest";

/** Per-test answers for the reads the instant-trade delegation check makes. */
export interface DelegationReads {
  /** Live virtual account → its parent sub-account. An unlisted account is not a virtual account. */
  parents?: Record<Address, Address>;
  /** Sub-account → owner. An unlisted account reads as unknown to the AccountLayer. */
  owners?: Record<Address, Address>;
  /** Whether `delegate` may sign `selector` for `delegator`. Defaults to `true`. */
  isDelegationActive?: (delegator: Address, delegate: Address, selector: Hex) => boolean;
}

/** One stubbed `readContract` request, as the delegation check issues it. */
interface StubRead {
  functionName: string;
  args: readonly unknown[];
}

/**
 * Program a mocked `readContract` to answer the delegation check's reads —
 * `getVirtualAccount`, `getSubAccount` and `isDelegationActive` — and reject
 * every other read. Addresses match case-insensitively.
 *
 * @internal test helper — not exported from the package.
 */
export function programDelegationReads(readContract: Mock, reads: DelegationReads = {}): void {
  const lookup = (map: Record<Address, Address> | undefined, account: Address) =>
    Object.entries(map ?? {}).find(([key]) => key.toLowerCase() === account.toLowerCase())?.[1];

  readContract.mockImplementation(async ({ functionName, args }: StubRead) => {
    if (functionName === "getVirtualAccount") {
      const parent = lookup(reads.parents, args[0] as Address);
      return { accountAddress: args[0], parentAccount: parent ?? zeroAddress, isExists: parent !== undefined };
    }
    if (functionName === "getSubAccount") {
      const owner = lookup(reads.owners, args[0] as Address);
      return { accountAddress: args[0], owner: owner ?? zeroAddress, isExists: owner !== undefined };
    }
    if (functionName === "isDelegationActive") {
      const [delegator, delegate, selector] = args as [Address, Address, Hex];
      return reads.isDelegationActive?.(delegator, delegate, selector) ?? true;
    }
    throw new Error(`Unexpected contract read: ${functionName}`);
  });
}

/**
 * The `[delegator, delegate, selector]` arguments of every `isDelegationActive`
 * read, in call order.
 *
 * @internal test helper — not exported from the package.
 */
export function delegationReads(readContract: Mock): unknown[][] {
  return readContract.mock.calls
    .map(([read]) => read as StubRead)
    .filter((read) => read.functionName === "isDelegationActive")
    .map((read) => [...read.args]);
}

/**
 * The function names of every stubbed read, in call order.
 *
 * @internal test helper — not exported from the package.
 */
export function readFunctionNames(readContract: Mock): string[] {
  return readContract.mock.calls.map(([read]) => (read as StubRead).functionName);
}
