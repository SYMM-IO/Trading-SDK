import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate registration paused",
  description: "SYMMIO has temporarily paused new affiliate registrations.",
};

export default function AffiliatePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 pt-32 pb-20 text-center sm:px-6 sm:pt-40 sm:pb-28">
      <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        Affiliate registration is temporarily paused
      </h1>
    </section>
  );
}
