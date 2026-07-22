"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { accountLayerAbi, getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import {
  useConnectWallet,
  useGeneratedAccountManagerAddress,
  useRequestToRegisterAffiliate,
  useSwitchToSymmioChain,
  useWalletAccount,
} from "@symmio/trading-react";
import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { parseEventLogs, type Address, type Hash, type TransactionReceipt } from "viem";
import { hyperEvm } from "wagmi/chains";
import { registrationSchema, sharesTotalBps, valuesToDraft, type RegistrationValues } from "./registration-schema";
import { BPS_SCALE, buildRegistration, normalizeDomain, toNotificationPayload } from "./registration-utils";

/** Delivery state of the off-chain notification sent to the team after submit. */
export type NotifyStatus = "idle" | "sending" | "sent" | "error";

/** The whitelisted Symmio core (diamond) new affiliates register against by default. */
const DEFAULT_SYMMIO_CORE = getChainConfig(SymmioSupportedChainId.HYPER_EVM).addresses.symmioAddress;

/** Ember coral — a sensible default the registrant can override in the color field. */
const DEFAULT_BRAND_COLOR = "#F0553A";

/** What the adaptive primary button should do next, given wallet + validity state. */
export type RegistrationAction = "connect" | "switch" | "submit";

/** The result captured once a registration transaction is mined. */
export interface RegistrationResult {
  name: string;
  registrant: Address;
  hash: Hash;
  /** Off-chain contact details echoed back for the success screen. */
  domain: string;
  email?: string;
  /**
   * The affiliate address the registration transaction actually created, read
   * from its `AffiliateRegistered` receipt event (falls back to the deterministic
   * prediction only if the event can't be parsed).
   */
  affiliate?: Address;
}

/**
 * Pull the affiliate address the registration transaction actually created from
 * its `AffiliateRegistered` receipt event — the ground truth for what was
 * registered, rather than re-deriving it. Returns `undefined` if the event is
 * absent (e.g. the write did not wait for a receipt), letting the caller fall
 * back to the deterministic prediction.
 */
function affiliateFromReceipt(receipt: TransactionReceipt): Address | undefined {
  const [event] = parseEventLogs({ abi: accountLayerAbi, eventName: "AffiliateRegistered", logs: receipt.logs });
  return event?.args.affiliate;
}

/** Fresh form values — the same defaults the legacy draft seeded. */
function makeDefaultValues(): RegistrationValues {
  return {
    name: "",
    brandColor: DEFAULT_BRAND_COLOR,
    admin: "",
    stakeholders: [{ receiver: "", percent: "60" }],
    symmioPercent: "40",
    metadata: "",
    symmioCores: [{ value: DEFAULT_SYMMIO_CORE }],
    legacyMultiAccounts: [],
    domain: "",
    email: "",
  };
}

/**
 * Owns the affiliate registration form on react-hook-form + yup: the field state
 * and its three field arrays, validation that only surfaces on blur/submit
 * (`mode: "onTouched"`), the wallet gate, the deterministic address preview, and
 * the submit transaction. Returns a flat API the form and its summary render from.
 */
export function useRegistrationForm() {
  const form = useForm<RegistrationValues>({
    resolver: yupResolver(registrationSchema),
    mode: "onTouched",
    defaultValues: makeDefaultValues(),
  });
  const { control, register, formState, setValue, getValues, handleSubmit, reset: resetForm } = form;

  const stakeholders = useFieldArray({ control, name: "stakeholders" });
  const cores = useFieldArray({ control, name: "symmioCores" });
  const legacy = useFieldArray({ control, name: "legacyMultiAccounts" });

  const [result, setResult] = useState<RegistrationResult>();
  const [honeypot, setHoneypot] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<NotifyStatus>("idle");

  const wallet = useWalletAccount();
  const { connectors, connect } = useConnectWallet();
  const { switchChain, status: switchStatus } = useSwitchToSymmioChain();
  const registerMutation = useRequestToRegisterAffiliate();

  /**
   * Seed the admin and first stakeholder with the connected address the first
   * time a wallet appears, so the common case (register yourself) needs no
   * typing. Never overwrites a value the user has already edited, and never
   * validates — seeding must not trip the blur/submit error gate.
   */
  const seededFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!wallet.address || seededFor.current === wallet.address) return;
    seededFor.current = wallet.address;
    if (getValues("admin").trim() === "") setValue("admin", wallet.address);
    if ((getValues("stakeholders.0.receiver") ?? "").trim() === "") {
      setValue("stakeholders.0.receiver", wallet.address);
    }
  }, [wallet.address, getValues, setValue]);

  /** Debounce the name that drives the address preview so typing isn't chatty. */
  const name = useWatch({ control, name: "name" });
  const [debouncedName, setDebouncedName] = useState("");
  useEffect(() => {
    const trimmed = (name ?? "").trim();
    const timer = setTimeout(() => setDebouncedName(trimmed), 400);
    return () => clearTimeout(timer);
  }, [name]);

  const prediction = useGeneratedAccountManagerAddress({
    registrant: wallet.address,
    name: debouncedName,
  });

  const brandColor = useWatch({ control, name: "brandColor" }) ?? DEFAULT_BRAND_COLOR;

  const action: RegistrationAction = !wallet.isConnected ? "connect" : !wallet.isOnExpectedChain ? "switch" : "submit";

  const isBusy = registerMutation.isPending || switchStatus === "pending";

  /** Copy the connected wallet into the admin field on demand. */
  function fillAdminFromWallet() {
    if (wallet.address) setValue("admin", wallet.address, { shouldValidate: true });
  }

  /**
   * Forward the off-chain details (domain, email) plus on-chain correlation
   * fields to the stateless notify route so the team can review and approve.
   * Fire-and-forget: a failure never blocks the on-chain success — it just flips
   * `notifyStatus` so the UI can offer a fallback.
   */
  async function sendNotification(values: RegistrationValues, txHash: Hash, registrant: Address, affiliate?: Address) {
    setNotifyStatus("sending");
    try {
      const payload = toNotificationPayload(valuesToDraft(values), {
        registrant,
        affiliate,
        chainId: wallet.chainId ?? hyperEvm.id,
        txHash,
        honeypot,
      });
      const response = await fetch("/api/affiliate-notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNotifyStatus(response.ok ? "sent" : "error");
    } catch {
      setNotifyStatus("error");
    }
  }

  /**
   * Runs only once every per-field yup rule passes. Enforces the cross-field
   * "shares total exactly 100%" rule here (it lives outside the schema); a failure
   * just aborts — the fee allocator already shows the reason once submitted.
   */
  async function onValid(values: RegistrationValues) {
    if (sharesTotalBps(values) !== BPS_SCALE) return;
    if (!wallet.address) return;
    try {
      const res = await registerMutation.mutateAsync({ registration: buildRegistration(valuesToDraft(values)) });
      /** Prefer the address the transaction actually created; the prediction is only a fallback. */
      const affiliate = (res.receipt && affiliateFromReceipt(res.receipt)) ?? (prediction.data as Address | undefined);
      setResult({
        name: values.name.trim(),
        registrant: wallet.address,
        hash: res.hash,
        domain: normalizeDomain(values.domain),
        email: values.email.trim() || undefined,
        affiliate,
      });
      void sendNotification(values, res.hash, wallet.address, affiliate);
    } catch {
      /* Error is surfaced through registerMutation.error below. */
    }
  }

  /** Adaptive primary action: connect, switch network, or submit the form. */
  async function onPrimary() {
    if (action === "connect") {
      const injected = connectors[0];
      if (injected) await connect(injected).catch(() => undefined);
      return;
    }
    if (action === "switch") {
      await switchChain().catch(() => undefined);
      return;
    }
    await handleSubmit(onValid)();
  }

  function reset() {
    setResult(undefined);
    setNotifyStatus("idle");
    setHoneypot("");
    registerMutation.reset();
    /**
     * Pre-fill the fresh form with the connected wallet the same way the seeding
     * effect does on first connect. Resetting `seededFor` to `undefined` alone
     * would not re-seed: mutating a ref never re-runs the effect (its deps are
     * unchanged), so with a wallet already connected the fields would stay empty.
     */
    const defaults = makeDefaultValues();
    if (wallet.address) {
      defaults.admin = wallet.address;
      if (defaults.stakeholders[0]) defaults.stakeholders[0].receiver = wallet.address;
      seededFor.current = wallet.address;
    } else {
      seededFor.current = undefined;
    }
    resetForm(defaults);
  }

  return {
    form,
    control,
    register,
    formState,
    stakeholders,
    cores,
    legacy,
    brandColor,
    defaultBrandColor: DEFAULT_BRAND_COLOR,
    setBrandColor: (value: string) => setValue("brandColor", value, { shouldDirty: true }),
    predicted: prediction.data as Address | undefined,
    isPredicting: prediction.isFetching,
    wallet,
    action,
    isBusy,
    submitError: registerMutation.error?.message,
    result,
    notifyStatus,
    honeypot,
    setHoneypot,
    fillAdminFromWallet,
    onPrimary,
    reset,
  };
}

/** The shape returned by {@link useRegistrationForm}, for prop typing. */
export type RegistrationFormApi = ReturnType<typeof useRegistrationForm>;
