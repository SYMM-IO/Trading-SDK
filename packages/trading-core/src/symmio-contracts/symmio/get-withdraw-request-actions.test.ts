import { getAddress, zeroAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getWithdrawRequestActions, type WithdrawRequestActions } from "./get-withdraw-request-actions";
import { WithdrawStatus } from "./types";

/** A synthetic provider whose checksummed and lowercase spellings differ. */
const PROVIDER = getAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd");

/** Every `WithdrawStatus` member; the numeric enum's reverse-mapped name keys are dropped. */
const STATUSES = Object.values(WithdrawStatus).filter((value): value is WithdrawStatus => typeof value === "number");

const NO_ACTIONS: WithdrawRequestActions = { finalize: false, cancel: false };

/**
 * Core's rules for a classic (zero-provider) request. A classic request never
 * reaches the provider statuses on-chain; those rows still pin Core's checks
 * literally (cancel is status-only, finalize needs `PENDING`).
 */
const CLASSIC: Record<WithdrawStatus, WithdrawRequestActions> = {
  [WithdrawStatus.PENDING]: { finalize: true, cancel: true },
  [WithdrawStatus.PROVIDER_ACCEPTED]: { finalize: false, cancel: true },
  [WithdrawStatus.PROVIDER_REJECTED]: NO_ACTIONS,
  [WithdrawStatus.COMPLETED]: NO_ACTIONS,
  [WithdrawStatus.CANCEL_REQUESTED]: NO_ACTIONS,
  [WithdrawStatus.CANCELLED]: NO_ACTIONS,
  [WithdrawStatus.SUSPENDED]: NO_ACTIONS,
};

/** Core's rules for a provider-backed (Express or virtual-provider) request. */
const PROVIDER_BACKED: Record<WithdrawStatus, WithdrawRequestActions> = {
  [WithdrawStatus.PENDING]: { finalize: false, cancel: true },
  [WithdrawStatus.PROVIDER_ACCEPTED]: { finalize: true, cancel: true },
  [WithdrawStatus.PROVIDER_REJECTED]: NO_ACTIONS,
  [WithdrawStatus.COMPLETED]: NO_ACTIONS,
  [WithdrawStatus.CANCEL_REQUESTED]: { finalize: true, cancel: false },
  [WithdrawStatus.CANCELLED]: NO_ACTIONS,
  [WithdrawStatus.SUSPENDED]: NO_ACTIONS,
};

const MATRIX = [
  { kind: "classic", provider: zeroAddress, expectedByStatus: CLASSIC },
  { kind: "provider-backed", provider: PROVIDER, expectedByStatus: PROVIDER_BACKED },
].flatMap(({ kind, provider, expectedByStatus }) =>
  STATUSES.map((status) => ({
    kind,
    statusName: WithdrawStatus[status],
    provider,
    status,
    expected: expectedByStatus[status],
  })),
);

describe("getWithdrawRequestActions", () => {
  it.each(MATRIX)("applies Core's rules to a $kind request in $statusName", ({ provider, status, expected }) => {
    expect(getWithdrawRequestActions({ provider, status })).toEqual(expected);
  });

  /** The zero address has no letters, so only a provider address can vary in case. */
  it.each([
    { spelling: "checksummed", provider: PROVIDER },
    { spelling: "lowercase", provider: PROVIDER.toLowerCase() as Address },
    { spelling: "uppercase", provider: `0x${PROVIDER.slice(2).toUpperCase()}` as Address },
  ])("reads the $spelling spelling of a provider address as provider-backed", ({ provider }) => {
    expect(PROVIDER).not.toBe(PROVIDER.toLowerCase());
    expect(getWithdrawRequestActions({ provider, status: WithdrawStatus.PENDING })).toEqual({
      finalize: false,
      cancel: true,
    });
    expect(getWithdrawRequestActions({ provider, status: WithdrawStatus.CANCEL_REQUESTED })).toEqual({
      finalize: true,
      cancel: false,
    });
  });

  it("reads a hand-written zero address as classic", () => {
    const zero: Address = `0x${"0".repeat(40)}`;

    expect(getWithdrawRequestActions({ provider: zero, status: WithdrawStatus.PENDING })).toEqual({
      finalize: true,
      cancel: true,
    });
  });
});
