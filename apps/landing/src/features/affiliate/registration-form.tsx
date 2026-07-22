"use client";

import { Button } from "@symmio/ui/components/button";
import { Input } from "@symmio/ui/components/input";
import { Label } from "@symmio/ui/components/label";
import { Separator } from "@symmio/ui/components/separator";
import { cn } from "@symmio/ui/lib/utils";
import { useState } from "react";
import type { UseFormRegister } from "react-hook-form";
import { FeeAllocator } from "./fee-allocator";
import { Field } from "./field";
import { CloseIcon, PlusIcon } from "./icons";
import type { RegistrationValues } from "./registration-schema";
import type { RegistrationFormApi } from "./use-registration-form";

interface FormProps {
  api: RegistrationFormApi;
}

/** A labeled, repeatable list of address inputs (used for cores and legacy accounts). */
function AddressList({
  legend,
  hint,
  fields,
  register,
  namePrefix,
  error,
  idPrefix,
  minEntries = 0,
  addLabel,
  onAdd,
  onRemove,
}: {
  legend: string;
  hint: string;
  fields: { id: string }[];
  register: UseFormRegister<RegistrationValues>;
  namePrefix: "symmioCores" | "legacyMultiAccounts";
  error?: string;
  idPrefix: string;
  minEntries?: number;
  addLabel: string;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-foreground text-sm font-medium">{legend}</legend>
      <p className="text-muted-foreground -mt-0.5 text-xs leading-5">{hint}</p>
      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-2">
            <Input
              id={`${idPrefix}-${index}`}
              placeholder="0x…"
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
              {...register(`${namePrefix}.${index}.value`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive shrink-0"
              disabled={fields.length <= minEntries}
              onClick={() => onRemove(index)}
              aria-label={`Remove ${legend} entry ${index + 1}`}
            >
              <CloseIcon />
            </Button>
          </div>
        ))}
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={onAdd}>
        <PlusIcon width={14} height={14} />
        {addLabel}
      </Button>
    </fieldset>
  );
}

/**
 * The left column of the registration experience: affiliate identity, the fee
 * allocator, and a collapsible Advanced block for metadata, Symmio cores, and
 * legacy accounts. Field state and validation come from react-hook-form via
 * {@link RegistrationFormApi}; errors surface only after a field is blurred or
 * the form is submitted.
 */
export function RegistrationForm({ api }: FormProps) {
  const { register, formState, wallet } = api;
  const { errors } = formState;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const brandColorValid = /^#[0-9a-fA-F]{6}$/.test(api.brandColor);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-foreground text-lg font-semibold tracking-tight">Identity</h3>
          <p className="text-muted-foreground text-sm">How your affiliate is named and administered on-chain.</p>
        </div>

        <Field
          id="affiliate-name"
          label="Affiliate name"
          placeholder="Acme Markets"
          error={errors.name?.message}
          hint="Public label for your affiliate. Also seeds your deterministic address."
          maxLength={64}
          spellCheck={false}
          className="font-sans"
          {...register("name")}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="brand-color">Brand color</Label>
          <div className="flex items-center gap-2">
            <label
              className="border-border relative size-9 shrink-0 overflow-hidden rounded-md border"
              style={{ backgroundColor: api.brandColor }}
            >
              <input
                id="brand-color"
                type="color"
                className="absolute inset-0 size-full cursor-pointer opacity-0"
                value={brandColorValid ? api.brandColor : api.defaultBrandColor}
                onChange={(event) => api.setBrandColor(event.target.value)}
                aria-label="Brand color picker"
              />
            </label>
            <Input
              value={api.brandColor}
              onChange={(event) => api.setBrandColor(event.target.value)}
              className="font-mono uppercase"
              placeholder="#F0553A"
              spellCheck={false}
            />
          </div>
          <p className="text-muted-foreground text-xs leading-5">Accent color stored with your affiliate profile.</p>
        </div>

        <Field
          id="affiliate-admin"
          label="Admin address"
          placeholder="0x…"
          error={errors.admin?.message}
          hint="Controls the affiliate — approves changes, pauses, and manages details."
          spellCheck={false}
          autoComplete="off"
          {...register("admin")}
          labelAction={
            wallet.address ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={api.fillAdminFromWallet}
                className="text-primary hover:text-primary/80 -mr-2 cursor-pointer font-medium"
              >
                Use my address
              </Button>
            ) : null
          }
        />
      </section>

      <Separator />

      <FeeAllocator api={api} />

      <Separator />

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-foreground text-lg font-semibold tracking-tight">Contact</h3>
          <p className="text-muted-foreground text-sm">
            Shared privately with the team to review and approve your request — never stored on-chain.
          </p>
        </div>

        <Field
          id="affiliate-domain"
          label="App or website domain"
          placeholder="app.acme.markets"
          error={errors.domain?.message}
          hint="Where your SYMMIO frontend lives. Scheme and path are trimmed automatically."
          spellCheck={false}
          autoComplete="off"
          inputMode="url"
          {...register("domain")}
        />

        <Field
          id="affiliate-email"
          label="Email"
          labelAction={<span className="text-muted-foreground text-xs">Optional</span>}
          type="email"
          placeholder="team@acme.markets"
          error={errors.email?.message}
          hint="Only used to let you know once your affiliate is approved."
          spellCheck={false}
          autoComplete="email"
          className="font-sans"
          {...register("email")}
        />

        {/* Honeypot — hidden from humans, tempting to bots. A filled value is rejected server-side. */}
        <input
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          value={api.honeypot}
          onChange={(event) => api.setHoneypot(event.target.value)}
          className="pointer-events-none absolute left-[-9999px] h-0 w-0 opacity-0"
        />
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="group flex items-center justify-between gap-2 text-left"
          aria-expanded={advancedOpen}
        >
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-foreground text-lg font-semibold tracking-tight">Advanced</h3>
            <p className="text-muted-foreground text-sm">Metadata, Symmio cores, and legacy accounts. Optional.</p>
          </div>
          <span
            className={cn(
              "text-muted-foreground group-hover:text-foreground transition-transform duration-200",
              advancedOpen && "rotate-45",
            )}
          >
            <PlusIcon width={18} height={18} />
          </span>
        </button>

        {advancedOpen ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="affiliate-metadata">Metadata</Label>
              <textarea
                id="affiliate-metadata"
                rows={2}
                placeholder="Plain text or 0x-encoded bytes"
                spellCheck={false}
                className="bg-input/40 border-border placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:bg-input/60 w-full resize-y rounded-md border px-3 py-2 font-mono text-sm transition-[color,box-shadow,background-color,border-color] outline-none focus-visible:ring-3"
                {...register("metadata")}
              />
              <p className="text-muted-foreground text-xs leading-5">
                Free-form text is UTF-8 encoded; a `0x…` value is stored as-is.
              </p>
            </div>

            <AddressList
              legend="Symmio cores"
              hint="Whitelisted core diamonds to register against. Defaults to HyperEVM."
              idPrefix="symmio-core"
              namePrefix="symmioCores"
              register={register}
              fields={api.cores.fields}
              error={errors.symmioCores?.message}
              minEntries={1}
              addLabel="Add core"
              onAdd={() => api.cores.append({ value: "" })}
              onRemove={(index) => api.cores.remove(index)}
            />

            <AddressList
              legend="Legacy multi-accounts"
              hint="Existing multi-accounts to link to this affiliate. Optional."
              idPrefix="legacy-account"
              namePrefix="legacyMultiAccounts"
              register={register}
              fields={api.legacy.fields}
              error={errors.legacyMultiAccounts?.message}
              addLabel="Add legacy account"
              onAdd={() => api.legacy.append({ value: "" })}
              onRemove={(index) => api.legacy.remove(index)}
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
