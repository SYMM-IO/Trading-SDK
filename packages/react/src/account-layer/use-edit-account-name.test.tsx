import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useEditAccountName } from "./use-edit-account-name";

vi.mock("@symm-frontier/core", async () => {
  const actual = await vi.importActual<typeof import("@symm-frontier/core")>("@symm-frontier/core");
  return {
    ...actual,
    editAccountName: vi.fn(),
  };
});

const core = await import("@symm-frontier/core");
const mockedEditAccountName = vi.mocked(core.editAccountName);

beforeEach(() => {
  mockedEditAccountName.mockReset();
});

describe("useEditAccountName", () => {
  it("rejects with kind 'sdk' when no wallet is connected, without calling core", async () => {
    /**
     * The test wrapper does not auto-connect the mock connector, so
     * `useWalletClient` resolves with `data: undefined`. The hook must
     * normalize that into a `sdk`-kind error rather than silently no-op-ing.
     */
    const { result } = renderHookWithProviders(() => useEditAccountName({ waitForReceipt: false }));

    let error: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({ account: TEST_EOA, name: "Trading" });
      } catch (e) {
        error = e;
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((error as { kind: string }).kind).toBe("sdk");
    expect(mockedEditAccountName).not.toHaveBeenCalled();
  });

  it("exposes a stable mutate function across renders (referential identity)", () => {
    /**
     * Hooks that return a fresh `mutate` every render trigger unwanted
     * re-renders in components that close over it. react-query's `mutate`
     * is stable; this guards against accidentally breaking that contract by
     * wrapping it in something that produces a new reference per render.
     */
    const { result, rerender } = renderHookWithProviders(() => useEditAccountName());
    const first = result.current.mutate;
    rerender();
    expect(result.current.mutate).toBe(first);
  });
});
