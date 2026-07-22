import { AffiliateProviders } from "@/features/affiliate/affiliate-providers";
import { AffiliateRegister } from "@/features/affiliate/affiliate-register";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become an affiliate",
  description:
    "Register as a SYMMIO affiliate on-chain: claim a deterministic affiliate address, set your fee split, and submit for approval.",
};

/**
 * The affiliate registration route. This is the only wallet-connected surface on
 * the landing site, so the SDK runtime providers are mounted here rather than in
 * the global layout — the rest of the marketing site stays presentational.
 */
export default function AffiliatePage() {
  return (
    <AffiliateProviders>
      <AffiliateRegister />
    </AffiliateProviders>
  );
}
