"use client";

import { AddressTag } from "@/components/address-tag";
import { Field } from "@/components/field";
import { ResultError, ResultNote, ResultSuccess } from "@/components/result";
import { TxReceipt } from "@/components/tx-result";
import { SubAccountIsolationType, accountLayerAbi, type SubAccountCreationData } from "@symm-frontier/core";
import {
  normalizeSymmError,
  useCreateSubAccounts,
  useSymmioConfig,
  useWalletAccount,
  type SymmioRequestError,
} from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Label } from "@symm-frontier/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symm-frontier/ui/components/select";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { Switch } from "@symm-frontier/ui/components/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@symm-frontier/ui/components/tooltip";
import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { isAddress, type Address } from "viem";
import { MethodCard } from "./method-card";
import { SimulateResult } from "./simulate-result";

const ISOLATION_OPTIONS = [
  {
    value: SubAccountIsolationType.POSITION,
    label: "POSITION",
    description: "One Virtual Account per trade — every position is isolated with its own margin.",
  },
  {
    value: SubAccountIsolationType.MARKET,
    label: "MARKET",
    description: "One Virtual Account per market — all trades on the same market share a VA.",
  },
  {
    value: SubAccountIsolationType.MARKET_DIRECTION,
    label: "MARKET_DIRECTION",
    description: "Separate Virtual Accounts per market and direction — longs and shorts stay isolated.",
  },
  {
    value: SubAccountIsolationType.CUSTOM,
    label: "CUSTOM",
    description: "No automatic VA creation — trade directly on the subaccount or via manually-created VAs.",
  },
] as const;

/** `singleVAMode` is only legal with MARKET / MARKET_DIRECTION isolation on-chain. */
function isSingleVaAllowed(isolation: SubAccountIsolationType): boolean {
  return isolation === SubAccountIsolationType.MARKET || isolation === SubAccountIsolationType.MARKET_DIRECTION;
}

export function WriteCreateSubAccounts() {
  const { address, chainId, isConnected, isOnExpectedChain } = useWalletAccount();
  const config = useSymmioConfig();
  const { addresses } = config.getChainConfig();

  const [name, setName] = useState<string>("");
  const [isolation, setIsolation] = useState<SubAccountIsolationType>(SubAccountIsolationType.MARKET_DIRECTION);
  const [singleVAMode, setSingleVAMode] = useState<boolean>(true);
  // Pre-fill the global defaults from SDK config; the user may override either per submission.
  const [affiliate, setAffiliate] = useState<string>(addresses.affiliatesAddress);
  const [symmioCore, setSymmioCore] = useState<string>(addresses.symmioAddress);

  const mutation = useCreateSubAccounts();

  const selectedIsolation = ISOLATION_OPTIONS.find((o) => o.value === isolation) ?? ISOLATION_OPTIONS[0];
  const validAffiliate = isAddress(affiliate) ? (affiliate as Address) : undefined;
  const validSymmioCore = isAddress(symmioCore) ? (symmioCore as Address) : undefined;
  const vaAllowed = isSingleVaAllowed(isolation);
  const effectiveSingleVA = vaAllowed && singleVAMode;
  const canSubmit =
    isConnected && isOnExpectedChain && name.trim().length > 0 && Boolean(validAffiliate) && Boolean(validSymmioCore);

  /** Build the per-subaccount payload once so Simulate and Send can never drift. */
  const buildAccountsData = (core: Address): readonly SubAccountCreationData[] => [
    { name: name.trim(), metadata: "0x", symmioCore: core, isolationType: isolation, singleVAMode: effectiveSingleVA },
  ];

  /** Dry-run the call (`simulateContract`) so the user sees pass/revert before sending. */
  const simulate = useMutation<
    readonly Address[],
    SymmioRequestError,
    { affiliate: Address; accountsData: readonly SubAccountCreationData[] }
  >({
    mutationFn: async (variables) => {
      try {
        const { result } = await config.getClient({ chainId }).simulateContract({
          address: addresses.accountLayerAddress,
          abi: accountLayerAbi,
          functionName: "createSubAccounts",
          args: [variables.affiliate, variables.accountsData],
          account: address,
        });
        return result;
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });

  return (
    <MethodCard
      testId="method-createSubAccounts"
      name="createSubAccounts"
      mutability="nonpayable"
      description="Create a subaccount for the connected wallet under the app's affiliate and Symmio core."
      wide
    >
      <Field label="name (display name)" htmlFor="input-create-name">
        <Input
          id="input-create-name"
          data-testid="input-create-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Trading Account"
          maxLength={100}
        />
      </Field>

      <Field
        label={
          <span className="flex items-center gap-1.5">
            isolationType
            <InfoTooltip label="What does this isolation type do?" testId="tooltip-isolation">
              {selectedIsolation.description}
            </InfoTooltip>
          </span>
        }
        htmlFor="select-isolation"
      >
        <Select value={String(isolation)} onValueChange={(v) => setIsolation(Number(v) as SubAccountIsolationType)}>
          <SelectTrigger id="select-isolation" data-testid="select-isolation">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ISOLATION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={String(opt.value)}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="border-border bg-muted/30 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="switch-single-va">singleVAMode</Label>
            <InfoTooltip label="What does single-VA mode do?" testId="tooltip-single-va">
              When enabled, repeated quotes on the same market reuse its active Virtual Account instead of opening a
              fresh VA per trade. Only available for MARKET and MARKET_DIRECTION isolation.
            </InfoTooltip>
          </div>
          {!vaAllowed && (
            <span className="text-muted-foreground text-xs">Requires MARKET or MARKET_DIRECTION isolation.</span>
          )}
        </div>
        <Switch
          id="switch-single-va"
          data-testid="switch-single-va"
          checked={effectiveSingleVA}
          onCheckedChange={setSingleVAMode}
          disabled={!vaAllowed}
        />
      </div>

      <OverridesPanel
        affiliate={affiliate}
        symmioCore={symmioCore}
        onAffiliateChange={setAffiliate}
        onSymmioCoreChange={setSymmioCore}
        defaultAffiliate={addresses.affiliatesAddress}
        defaultSymmioCore={addresses.symmioAddress}
        affiliateValid={Boolean(validAffiliate)}
        symmioCoreValid={Boolean(validSymmioCore)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSubmit || simulate.isPending}
          onClick={() => {
            if (!canSubmit || !validAffiliate || !validSymmioCore) return;
            simulate.mutate({ affiliate: validAffiliate, accountsData: buildAccountsData(validSymmioCore) });
          }}
          data-testid="button-simulate-create"
        >
          {simulate.isPending ? (
            <>
              <Spinner className="size-4" /> Simulating…
            </>
          ) : (
            "Simulate"
          )}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || mutation.isPending}
          onClick={() => {
            if (!canSubmit || !validAffiliate || !validSymmioCore) return;
            mutation.mutate({ affiliate: validAffiliate, accountsData: buildAccountsData(validSymmioCore) });
          }}
          data-testid="button-send-create"
        >
          {mutation.isPending ? (
            <>
              <Spinner className="size-4" /> Sending…
            </>
          ) : (
            "Send transaction"
          )}
        </Button>
      </div>

      <SimulateResult
        isPending={simulate.isPending}
        isSuccess={simulate.isSuccess}
        error={simulate.error}
        testId="result-simulate-createSubAccounts"
      >
        {simulate.data && simulate.data.length > 0 ? (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">
              Predicted subaccount {simulate.data.length === 1 ? "address" : "addresses"}:
            </span>
            {simulate.data.map((addr) => (
              <AddressTag key={addr} address={addr} />
            ))}
          </div>
        ) : null}
      </SimulateResult>

      <WritePanel mutation={mutation} />
    </MethodCard>
  );
}

interface OverridesPanelProps {
  affiliate: string;
  symmioCore: string;
  onAffiliateChange: (value: string) => void;
  onSymmioCoreChange: (value: string) => void;
  defaultAffiliate: Address;
  defaultSymmioCore: Address;
  affiliateValid: boolean;
  symmioCoreValid: boolean;
}

/**
 * Affiliate / Symmio-core overrides. These rarely change (essentially per chain),
 * so they sit as a compact read-only summary by default and expand into editable
 * inputs on demand. Invalid values force the editor open so they can be fixed.
 */
function OverridesPanel({
  affiliate,
  symmioCore,
  onAffiliateChange,
  onSymmioCoreChange,
  defaultAffiliate,
  defaultSymmioCore,
  affiliateValid,
  symmioCoreValid,
}: OverridesPanelProps) {
  const [open, setOpen] = useState(false);
  const isCustom = affiliate !== defaultAffiliate || symmioCore !== defaultSymmioCore;
  const mustEdit = !affiliateValid || !symmioCoreValid;
  const expanded = open || mustEdit;

  return (
    <div className="border-border bg-muted/30 overflow-hidden rounded-xl border">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
            Affiliate · Symmio core
          </span>
          <Badge variant={isCustom ? "info" : "secondary"} className="px-1.5 py-0 text-[10px] tracking-wide uppercase">
            {isCustom ? "Custom" : "Default"}
          </Badge>
        </div>
        {expanded ? (
          !mustEdit && (
            <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(false)} data-testid="overrides-done">
              Done
            </Button>
          )
        ) : (
          <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(true)} data-testid="overrides-edit">
            Override
          </Button>
        )}
      </div>

      {expanded ? (
        <div className="border-border/60 space-y-3 border-t px-3.5 py-3">
          <OverrideField
            id="input-create-affiliate"
            testId="affiliate"
            label="affiliate"
            value={affiliate}
            onChange={onAffiliateChange}
            valid={affiliateValid}
            defaultValue={defaultAffiliate}
          />
          <OverrideField
            id="input-create-symmio-core"
            testId="symmio-core"
            label="symmioCore (Symmio diamond)"
            value={symmioCore}
            onChange={onSymmioCoreChange}
            valid={symmioCoreValid}
            defaultValue={defaultSymmioCore}
          />
        </div>
      ) : (
        <dl className="border-border/60 grid grid-cols-[6rem_1fr] items-center gap-x-3 gap-y-2 border-t px-3.5 py-2.5 text-xs">
          <dt className="text-muted-foreground">affiliate</dt>
          <dd className="justify-self-start">
            <AddressTag address={affiliate} chars={6} explorer={false} />
          </dd>
          <dt className="text-muted-foreground">symmioCore</dt>
          <dd className="justify-self-start">
            <AddressTag address={symmioCore} chars={6} explorer={false} />
          </dd>
        </dl>
      )}
    </div>
  );
}

interface OverrideFieldProps {
  id: string;
  testId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  valid: boolean;
  defaultValue: Address;
}

function OverrideField({ id, testId, label, value, onChange, valid, defaultValue }: OverrideFieldProps) {
  const isCustom = value !== defaultValue;
  return (
    <Field
      label={label}
      htmlFor={id}
      action={
        isCustom ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            onClick={() => onChange(defaultValue)}
            data-testid={`reset-${testId}`}
          >
            Reset to default
          </button>
        ) : null
      }
    >
      <Input
        id={id}
        data-testid={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0x…"
        className="font-mono"
        aria-invalid={value.length > 0 && !valid}
      />
    </Field>
  );
}

function InfoTooltip({ label, testId, children }: { label: string; testId?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          data-testid={testId}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/30 inline-flex items-center justify-center rounded-full outline-none focus-visible:ring-2"
        >
          <InfoIcon />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

function WritePanel({ mutation }: { mutation: ReturnType<typeof useCreateSubAccounts> }) {
  if (mutation.isPending) {
    return (
      <ResultNote testId="result-createSubAccounts-pending" loading>
        Submitting transaction… waiting for wallet, then receipt.
      </ResultNote>
    );
  }
  if (mutation.error) {
    return (
      <ResultError
        testId="result-createSubAccounts-error"
        kind={mutation.error.kind}
        message={mutation.error.message}
      />
    );
  }
  if (mutation.isSuccess) {
    return (
      <ResultSuccess testId="result-createSubAccounts-success">
        <span className="text-foreground">Submitted. The new subaccount appears in the list once mined.</span>
        <TxReceipt
          hash={mutation.data.hash}
          receipt={
            mutation.data.receipt
              ? { blockNumber: mutation.data.receipt.blockNumber, status: String(mutation.data.receipt.status) }
              : undefined
          }
        />
      </ResultSuccess>
    );
  }
  return <ResultNote testId="result-createSubAccounts-idle">Fill the fields above and submit.</ResultNote>;
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
      <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7.25v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.9" fill="currentColor" />
    </svg>
  );
}
