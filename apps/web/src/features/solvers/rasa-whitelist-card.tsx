"use client";

import { BoolBadge } from "@/components/bool-badge";
import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { useAddSolverWhitelist, useCheckSolverWhitelist } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "./solver-target";

/** Rasa-only card: whitelist check + add (`/check_in-whitelist`, `/add-sub-address-in-whitelist`). */
export function RasaWhitelistCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const [address, setAddress] = useState("");
  const validAddress = isAddress(address) ? (address as Address) : undefined;

  const checkQuery = useCheckSolverWhitelist({
    chainId: target.chainId,
    solverId: target.solverId,
    address: validAddress ?? "0x0000000000000000000000000000000000000000",
    query: { enabled: false },
  });
  const addMutation = useAddSolverWhitelist();

  return (
    <MethodCard
      testId="method-rasa-whitelist"
      name="checkSolverWhitelist / addSolverWhitelist"
      mutability="nonpayable"
      description="Check whether an address is on the solver's whitelist, or add it. The add call mutates solver-side state. Rasa-only endpoints."
      wide
    >
      <SolverTargetSelect value={target} onChange={setTarget} requireKind="rasa" testId="select-rasa-wl-solver" />
      <Field label="address" htmlFor="input-rasa-wl-address">
        <Input
          id="input-rasa-wl-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="0x…"
          aria-invalid={address.length > 0 && !validAddress}
          data-testid="input-rasa-wl-address"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!validAddress || checkQuery.isFetching}
          onClick={() => void checkQuery.refetch()}
          data-testid="button-check-rasa-whitelist"
        >
          {checkQuery.isFetching ? (
            <>
              <Spinner className="size-4" /> Checking...
            </>
          ) : (
            "Check"
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!validAddress || addMutation.isPending}
          onClick={() => {
            if (!validAddress) return;
            addMutation.mutate({ address: validAddress, chainId: target.chainId, solverId: target.solverId });
          }}
          data-testid="button-add-rasa-whitelist"
        >
          {addMutation.isPending ? (
            <>
              <Spinner className="size-4" /> Adding...
            </>
          ) : (
            "Add to whitelist"
          )}
        </Button>
      </div>
      {checkQuery.error ? (
        <ResultError
          testId="result-rasa-whitelist-check-error"
          kind={checkQuery.error.kind}
          message={checkQuery.error.message}
        />
      ) : checkQuery.data !== undefined ? (
        <div className="flex items-center gap-2 text-sm" data-testid="result-rasa-whitelist-check">
          <span className="text-muted-foreground">whitelisted:</span> <BoolBadge value={checkQuery.data} />
        </div>
      ) : null}
      {addMutation.error ? (
        <ResultError
          testId="result-rasa-whitelist-add-error"
          kind={addMutation.error.kind}
          message={addMutation.error.message}
        />
      ) : addMutation.isSuccess ? (
        <ResultSuccess testId="result-rasa-whitelist-add">
          <span className="text-foreground">
            {addMutation.data.successful ? "Added." : `Not added: ${addMutation.data.message ?? "unknown reason"}`}
          </span>
        </ResultSuccess>
      ) : null}
      {checkQuery.data === undefined && !checkQuery.error && !addMutation.isSuccess && !addMutation.error ? (
        <ResultNote testId="result-rasa-whitelist-idle">Enter an address, then check or add.</ResultNote>
      ) : null}
    </MethodCard>
  );
}
