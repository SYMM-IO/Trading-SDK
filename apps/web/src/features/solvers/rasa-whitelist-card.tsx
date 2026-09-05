"use client";

import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { useAddSolverWhitelist } from "@symmio/trading-react";
import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Spinner } from "@symmio/ui/components/spinner";
import { useState } from "react";
import type { Address } from "viem";
import { isAddress } from "viem";
import { MethodCard } from "../inspector/method-card";
import { SolverTargetSelect, useSolverTargetState } from "./solver-target";

/** Rasa-only card: add a subaccount to the solver whitelist (`/add-sub-address-in-whitelist`). */
export function RasaWhitelistCard() {
  const { target, setTarget } = useSolverTargetState({ requireKind: "rasa" });
  const [address, setAddress] = useState("");
  const validAddress = isAddress(address) ? (address as Address) : undefined;

  const addMutation = useAddSolverWhitelist();

  return (
    <MethodCard
      testId="method-rasa-whitelist"
      name="addSolverWhitelist"
      mutability="nonpayable"
      description="Add an address to the solver's whitelist. The call mutates solver-side state. Rasa-only endpoint."
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
      ) : (
        <ResultNote testId="result-rasa-whitelist-idle">Enter an address, then add.</ResultNote>
      )}
    </MethodCard>
  );
}
