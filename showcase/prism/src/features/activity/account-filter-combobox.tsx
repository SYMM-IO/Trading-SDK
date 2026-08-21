"use client";

import { MultiCombobox, type ComboboxGroup } from "@/components/combobox";
import { shortenAddress } from "@/lib/format";
import { useMemo } from "react";
import type { Address } from "viem";
import type { AccountFilter } from "./activity-types";
import type { ActivityAccountOptionGroup } from "./use-activity-accounts";

export interface AccountFilterComboboxProps {
  value: AccountFilter;
  groups: readonly ActivityAccountOptionGroup[];
  onChange: (value: AccountFilter) => void;
}

/** Above this many accounts the list stops being scannable and gets a filter. */
const SEARCH_THRESHOLD = 5;

/** Above this many accounts, ticking a deployment row by row stops being reasonable. */
const GROUP_TOGGLE_THRESHOLD = 3;

/**
 * The Activity screen's account filter.
 *
 * A wallet can hold any number of sub-accounts on each deployment, and their
 * names are user-chosen — "test2", "salam", "hwel" — so the list is neither
 * short nor self-ordering. It is grouped by deployment (the boundary funds
 * never cross), each group folds away, and the address rides along under every
 * name because two accounts are allowed to share one.
 *
 * The selection is a set rather than a single pick: "these three accounts" is
 * the question a trader running a dozen of them actually asks, and answering it
 * one account at a time means reading the same blotter twelve times. An empty
 * set means every account in scope, so the filter can always be widened back.
 */
export function AccountFilterCombobox({ value, groups, onChange }: AccountFilterComboboxProps) {
  const total = groups.reduce((count, group) => count + group.options.length, 0);

  const comboGroups = useMemo<ComboboxGroup<Address>[]>(
    () =>
      groups.map((group) => ({
        key: group.family,
        label: `${group.label} · ${group.chainName}`,
        short: group.label,
        accent: `var(--${group.tone}-500)`,
        options: group.options.map((option) => ({
          value: option.value,
          label: option.label,
          hint: shortenAddress(option.address),
          /* The deployment is searchable from inside the group too: typing
             "base" should reach every account that settles there. */
          keywords: `${group.label} ${group.chainName} ${option.address}`,
        })),
      })),
    [groups],
  );

  const scope =
    value.length === 0
      ? groups.map((group) => `${group.label} (${group.options.length})`).join(" · ")
      : `${value.length} of ${total} selected`;

  return (
    <MultiCombobox<Address>
      label="Funding accounts"
      values={value}
      onChange={onChange}
      groups={comboGroups}
      groupToggle={total > GROUP_TOGGLE_THRESHOLD}
      emptyLabel="All accounts"
      noun="account"
      searchable={total > SEARCH_THRESHOLD}
      searchPlaceholder="Name or address…"
      emptyText="No account matches"
      footer={
        total > 0 ? (
          <span className="flex items-center gap-2">
            <span className="truncate">{scope}</span>
            {value.length > 0 ? (
              <button
                type="button"
                onClick={() => onChange([])}
                className="ml-auto shrink-0 cursor-pointer text-2xs text-fg-2 underline-offset-2 hover:text-fg-0 hover:underline"
              >
                show all
              </button>
            ) : null}
          </span>
        ) : undefined
      }
      disabled={total === 0}
      menuWidth={286}
      className="max-w-[240px]"
    />
  );
}
