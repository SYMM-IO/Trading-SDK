import type { ReactNode } from "react";

interface Props {
  testId: string;
  name: string;
  mutability: "view" | "nonpayable";
  description: string;
  children: ReactNode;
}

/**
 * Visual frame for a single AccountLayer method on the Inspector page.
 * Mirrors Explorer's `MethodRow` + form pairing: header (name + mut pill +
 * blurb), body (inputs + result panel).
 */
export function MethodCard({ testId, name, mutability, description, children }: Props) {
  const pillTone = mutability === "view" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";

  return (
    <section
      data-testid={testId}
      className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-mono text-base text-zinc-950 dark:text-zinc-50">{name}</h2>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${pillTone}`}>{mutability}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{description}</span>
      </header>
      <div className="space-y-4 px-4 py-4">{children}</div>
    </section>
  );
}
