"use client";

import { ResultError, ResultNote } from "@/components/result";
import { Stat } from "@/components/stat";
import { useDeallocateDebounceTime, useWithdrawCooldownOf } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import { isAddress, zeroAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { SubAccountField } from "./subaccount-field";

/**
 * Inspector card for `withdrawCooldownOf`: a subaccount's raw deallocate
 * timestamp, and the earliest next deallocation it allows once the protocol's
 * debounce is added. Both reads send only on **Read**, never per keystroke.
 */
export function ReadWithdrawCooldownOf() {
  const [input, setInput] = useState<string>("");
  const validUser = isAddress(input) ? (input as Address) : undefined;

  /** `user` is required by the hook; the placeholder is never read, since the Read button needs a valid address. */
  const cooldown = useWithdrawCooldownOf({ user: validUser ?? zeroAddress, query: { enabled: false } });
  const debounce = useDeallocateDebounceTime({ query: { enabled: false } });
  const isFetching = cooldown.isFetching || debounce.isFetching;

  return (
    <MethodCard
      testId="method-getWithdrawCooldownOf"
      name="getWithdrawCooldownOf"
      mutability="view"
      description="Read when a subaccount was last deallocated or credited to withdrawable balance, and when it can deallocate next."
    >
      <SubAccountField
        idPrefix="withdraw-cooldown-user"
        label="user (subaccount address)"
        value={input}
        onValueChange={setInput}
        invalid={input.length > 0 && !validUser}
      />

      <Button
        type="button"
        size="sm"
        disabled={!validUser || isFetching}
        onClick={() => {
          void cooldown.refetch();
          void debounce.refetch();
        }}
        data-testid="button-read-withdraw-cooldown-of"
      >
        {isFetching ? (
          <>
            <Spinner className="size-4" /> Reading…
          </>
        ) : (
          "Read"
        )}
      </Button>

      <ResultPanel testId="result-getWithdrawCooldownOf" cooldown={cooldown} debounce={debounce} />
    </MethodCard>
  );
}

interface ResultPanelProps {
  testId: string;
  cooldown: ReturnType<typeof useWithdrawCooldownOf>;
  debounce: ReturnType<typeof useDeallocateDebounceTime>;
}

function ResultPanel({ testId, cooldown, debounce }: ResultPanelProps) {
  const error = cooldown.error ?? debounce.error;
  if (error) {
    return <ResultError testId={`${testId}-error`} kind={error.kind} message={error.message} />;
  }
  if (cooldown.isFetching && cooldown.data === undefined) {
    return (
      <ResultNote testId={`${testId}-loading`} loading>
        Loading…
      </ResultNote>
    );
  }
  if (cooldown.data === undefined) {
    return <ResultNote testId={`${testId}-idle`}>Run the read to see the subaccount’s cooldown timestamp.</ResultNote>;
  }

  if (cooldown.data === 0n) {
    return (
      <div data-testid={`${testId}-data`}>
        <Stat
          label="Last stamped"
          value="Never"
          hint="No deallocation or withdrawable credit yet, so the debounce does not hold the next deallocate."
        />
      </div>
    );
  }

  const stampedAt = new Date(Number(cooldown.data) * 1000);

  return (
    <div data-testid={`${testId}-data`} className="flex flex-wrap gap-x-8 gap-y-4">
      <Stat
        label="Last stamped at"
        value={stampedAt.toLocaleString()}
        hint={`Unix ${String(cooldown.data)} · a timestamp, not a duration`}
      />
      {debounce.data === undefined ? null : <NextDeallocate stamp={cooldown.data} debounce={debounce.data} />}
    </div>
  );
}

/** The earliest time the core accepts another deallocation: the stamp plus the protocol debounce. */
function NextDeallocate({ stamp, debounce }: { stamp: bigint; debounce: bigint }) {
  const when = new Date(Number(stamp + debounce) * 1000);
  const isPast = Date.now() >= when.getTime();
  return (
    <Stat
      label="Next deallocate from"
      value={when.toLocaleString()}
      hint={
        isPast
          ? "Debounce elapsed: a deallocate can go through now."
          : `Stamp + ${String(debounce)} s debounce; an earlier deallocate reverts.`
      }
    />
  );
}
