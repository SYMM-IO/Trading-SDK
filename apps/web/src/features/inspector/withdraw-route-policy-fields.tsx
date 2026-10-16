"use client";

import { Field } from "@/components/field";
import type { ExpressWithdrawOptionName, ExpressWithdrawRoutePolicy } from "@symmio/trading-core";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symmio/ui/components/select";
import { useState } from "react";
import type { WithdrawIntent } from "./withdraw-intent-fields";

/** The inputs a route read was last sent with: the intent plus the policy it was prepared under. */
export interface RouteRequest {
  intent: WithdrawIntent;
  policy?: ExpressWithdrawRoutePolicy;
}

interface PriorityPreset {
  label: string;
  description: string;
  /** `undefined` leaves the order to the SDK. */
  optionPriority?: readonly ExpressWithdrawOptionName[];
}

/** Option orderings the policy select offers. */
const PRIORITY_PRESETS = {
  default: { label: "SDK default", description: "SAME_TX, then STANDARD" },
  "same-tx": { label: "SAME_TX only", description: "Accept only a SAME_TX offer", optionPriority: ["SAME_TX"] },
  windowed: {
    label: "WINDOWED only",
    description: "Accept only a WINDOWED offer — never picked by default",
    optionPriority: ["WINDOWED"],
  },
  standard: { label: "STANDARD only", description: "Accept only a STANDARD offer", optionPriority: ["STANDARD"] },
  all: {
    label: "Every option",
    description: "SAME_TX, then WINDOWED, then STANDARD",
    optionPriority: ["SAME_TX", "WINDOWED", "STANDARD"],
  },
} as const satisfies Record<string, PriorityPreset>;

type PriorityKey = keyof typeof PRIORITY_PRESETS;

type Fallback = NonNullable<ExpressWithdrawRoutePolicy["fallback"]>;

const FALLBACKS: Record<Fallback, { label: string; description: string }> = {
  classic: { label: "classic", description: "Fall back to the classic route (SDK default)" },
  error: { label: "error", description: "Throw when no preferred Express option is available" },
};

/** Route-policy select state for {@link RoutePolicyFields}. */
export interface RoutePolicyForm {
  priority: PriorityKey;
  fallback: Fallback;
  setPriority: (value: PriorityKey) => void;
  setFallback: (value: Fallback) => void;
  /** The policy to pass to the SDK, or `undefined` when both selects sit on the SDK defaults. */
  policy?: ExpressWithdrawRoutePolicy;
}

/** Own the option-priority and fallback selects shared by the route cards. */
export function useRoutePolicyForm(): RoutePolicyForm {
  const [priority, setPriority] = useState<PriorityKey>("default");
  const [fallback, setFallback] = useState<Fallback>("classic");

  const preset: PriorityPreset = PRIORITY_PRESETS[priority];
  const policy =
    preset.optionPriority === undefined && fallback === "classic"
      ? undefined
      : { ...(preset.optionPriority ? { optionPriority: preset.optionPriority } : {}), fallback };

  return { priority, fallback, setPriority, setFallback, policy };
}

interface Props {
  /** Namespaces the field ids and `data-testid`s. */
  idPrefix: string;
  form: RoutePolicyForm;
  /** Called after either select changes. */
  onEdit?: () => void;
}

/** `policy.optionPriority` and `policy.fallback` selects for the Express route actions. */
export function RoutePolicyFields({ idPrefix, form, onEdit }: Props) {
  return (
    <div className="flex flex-wrap gap-4">
      <Field label="policy.optionPriority" htmlFor={`${idPrefix}-priority`} className="min-w-48 flex-1">
        <Select
          value={form.priority}
          onValueChange={(value) => {
            form.setPriority(value as PriorityKey);
            onEdit?.();
          }}
        >
          <SelectTrigger id={`${idPrefix}-priority`} data-testid={`${idPrefix}-priority`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRIORITY_PRESETS).map(([key, preset]) => (
              <SelectItem key={key} value={key} description={preset.description}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="policy.fallback" htmlFor={`${idPrefix}-fallback`} className="min-w-48 flex-1">
        <Select
          value={form.fallback}
          onValueChange={(value) => {
            form.setFallback(value as Fallback);
            onEdit?.();
          }}
        >
          <SelectTrigger id={`${idPrefix}-fallback`} data-testid={`${idPrefix}-fallback`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FALLBACKS).map(([key, fallback]) => (
              <SelectItem key={key} value={key} description={fallback.description}>
                {fallback.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}
