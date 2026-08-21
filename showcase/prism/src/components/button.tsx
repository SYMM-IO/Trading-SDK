"use client";

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "long" | "short" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Renders a spinner and blocks interaction. */
  loading?: boolean;
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  /* Primary uses the mode accent — one primary action per view. */
  primary: "bg-accent text-fg-inverse border-transparent hover:brightness-110",
  secondary: "bg-bg-2 text-fg-0 border-line hover:border-line-strong hover:bg-bg-3",
  ghost: "bg-transparent text-fg-2 border-transparent hover:bg-bg-2 hover:text-fg-0",
  /* Directional buttons use a vertical gradient plus the matching glow — and
     never the accent. Direction owns green and red. */
  long: "bg-[linear-gradient(180deg,var(--long-300),var(--long-500))] text-fg-inverse border-transparent shadow-[var(--shadow-long-glow)] hover:brightness-105",
  short:
    "bg-[linear-gradient(180deg,var(--short-300),var(--short-500))] text-fg-inverse border-transparent shadow-[var(--shadow-short-glow)] hover:brightness-105",
  danger: "bg-short-bg text-short border-[var(--short-500)]/40 hover:bg-[var(--short-500)]/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-sm rounded-sm",
  md: "h-9 px-4 text-md rounded-md",
  lg: "h-11 px-5 text-lg rounded-md",
};

/** The system's only button. Every CTA in the app is one of these six variants. */
export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 border font-sans font-semibold whitespace-nowrap",
        "transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:brightness-100",
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent"
      style={{ animation: "prism-spin 700ms linear infinite" }}
    />
  );
}
