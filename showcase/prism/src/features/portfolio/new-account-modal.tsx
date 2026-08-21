"use client";

import { Field } from "@/components/field";
import { Modal } from "@/components/modal";
import { ReceiptRow } from "@/components/value";
import type { Deployment } from "@/config/deployments";
import { shortenAddress } from "@/lib/format";
import { SubAccountIsolationType, type SubAccountDetail } from "@symmio/trading-core";
import { useCreateSubAccounts, useSymmioConfig } from "@symmio/trading-react";
import { useState } from "react";
import { GatedSubmit } from "./gated-submit";
import { useWriteToast } from "./use-write-toast";

export interface NewAccountModalProps {
  deployment: Deployment;
  /** Accounts already in this group — used for the default name and the template. */
  existingCount: number;
  /** An existing account on this deployment, whose isolation the new one copies. */
  template?: SubAccountDetail;
  open: boolean;
  onClose: () => void;
}

const ISOLATION_LABELS: Record<SubAccountIsolationType, string> = {
  [SubAccountIsolationType.POSITION]: "One Virtual Account per trade",
  [SubAccountIsolationType.MARKET]: "One Virtual Account per market",
  [SubAccountIsolationType.MARKET_DIRECTION]: "One Virtual Account per market and side",
  [SubAccountIsolationType.CUSTOM]: "Cross-margin on the sub-account",
};

/**
 * Create another funding account inside one deployment's group.
 *
 * `createSubAccounts` needs the affiliate and the SYMMIO core the account will
 * trade against; both come out of the SDK's own chain registry rather than
 * being typed here. The isolation strategy is copied from an account that
 * already exists on this deployment when there is one, so a second account
 * behaves like the first instead of silently trading under different margin
 * rules.
 */
export function NewAccountModal({ deployment, existingCount, template, open, onClose }: NewAccountModalProps) {
  const config = useSymmioConfig();
  const runWrite = useWriteToast();
  const createAccounts = useCreateSubAccounts();
  const [name, setName] = useState(`${deployment.label} ${existingCount + 1}`);

  const { affiliatesAddress, symmioAddress } = config.getChainConfig(deployment.chainId).addresses;
  const defaults = creationDefaultsFor(deployment, template);

  const trimmed = name.trim();
  const isValid = trimmed.length > 0 && trimmed.length <= 100;

  const onCreate = () => {
    void runWrite(
      {
        pending: "Creating account…",
        success: "Account created",
        body: `${trimmed} is live on ${deployment.chainName}.`,
      },
      async () => {
        const result = await createAccounts.mutateAsync({
          affiliate: affiliatesAddress,
          accountsData: [
            {
              name: trimmed,
              metadata: "0x",
              symmioCore: symmioAddress,
              isolationType: defaults.isolationType,
              singleVAMode: defaults.singleVAMode,
            },
          ],
          chainId: deployment.chainId,
        });
        onClose();
        return result;
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={`${deployment.solverName} · ${deployment.chainName}`}
      title={`New ${deployment.family} account`}
      footer={
        <>
          <GatedSubmit
            deployment={deployment}
            label="Create account"
            onSubmit={onCreate}
            disabled={!isValid}
            loading={createAccounts.isPending}
            size="lg"
            className="w-full"
          />
          <p className="text-center text-2xs text-fg-3">
            The new account belongs to the {deployment.label} group and can only be funded from it.
          </p>
        </>
      }
    >
      <Field
        label="Account name"
        value={name}
        maxLength={100}
        onChange={(event) => setName(event.target.value)}
        footnote="Stored on-chain, 1–100 characters. Editable later."
      />

      <div className="flex flex-col divide-y divide-[var(--border-subtle)]">
        <ReceiptRow
          label="Margin model"
          value={<span className="text-sm text-fg-1">{ISOLATION_LABELS[defaults.isolationType]}</span>}
        />
        <ReceiptRow
          label="Reuse the active VA"
          value={<span className="text-sm text-fg-1">{defaults.singleVAMode ? "Yes" : "Not used"}</span>}
        />
        <ReceiptRow
          label="SYMMIO core"
          value={<span className="tnum text-sm text-fg-1">{shortenAddress(symmioAddress)}</span>}
        />
        <ReceiptRow
          label="Affiliate"
          value={<span className="tnum text-sm text-fg-1">{shortenAddress(affiliatesAddress)}</span>}
        />
      </div>
    </Modal>
  );
}

/**
 * Isolation defaults for a brand-new account on a deployment.
 *
 * Copies an existing account when one is available; otherwise falls back to the
 * shape each solver is built around — Rasa runs cross-margin directly on the
 * sub-account, Enigma isolates every market and side into its own Virtual
 * Account. `singleVAMode` is only legal alongside `MARKET` / `MARKET_DIRECTION`;
 * the contract reverts otherwise, so it is off for `CUSTOM`.
 */
function creationDefaultsFor(
  deployment: Deployment,
  template?: SubAccountDetail,
): { isolationType: SubAccountIsolationType; singleVAMode: boolean } {
  if (template) {
    return { isolationType: template.isolationType, singleVAMode: template.singleVAMode };
  }
  return deployment.family === "majors"
    ? { isolationType: SubAccountIsolationType.CUSTOM, singleVAMode: false }
    : { isolationType: SubAccountIsolationType.MARKET_DIRECTION, singleVAMode: true };
}
