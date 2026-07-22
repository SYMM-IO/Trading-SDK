"use client";

import { Reveal } from "@/components/reveal";
import { routes, siteLinks } from "@/lib/site";
import { Button } from "@symmio/ui/components/button";

/**
 * Home-page invitation into the affiliate program. Presentational only — no SDK
 * or wallet code (that lives on `/affiliate`); this band just routes there.
 * A single coral-lit panel with the site's animated live border, so it reads as
 * the one "act now" moment on the page without shouting.
 */
export function BecomeAffiliateCta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <Reveal>
        <div className="card-live-border ring-border/60 bg-card/50 relative overflow-hidden rounded-3xl p-8 ring-1 sm:p-12">
          {/* Coral bloom anchored to the corner, behind the content. */}
          <div
            className="pointer-events-none absolute -top-24 -right-16 size-80 rounded-full opacity-60 blur-3xl"
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in oklab, var(--primary) 26%, transparent), transparent)",
            }}
            aria-hidden
          />
          <div className="relative flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex max-w-xl flex-col gap-4">
              <span className="text-primary inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase">
                <span className="bg-primary/70 size-1.5 rounded-full" aria-hidden />
                Affiliate Program
              </span>
              <h2 className="font-display text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Building on SYMMIO? Register as an affiliate.
              </h2>
              <p className="text-muted-foreground text-base leading-7 text-pretty">
                Claim a deterministic on-chain address, set how fees split across your stakeholders, and submit for
                approval — in a few fields, from your wallet.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <a href={routes.affiliate}>Become an affiliate</a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={siteLinks.docs} target="_blank" rel="noreferrer">
                  Read the docs
                </a>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
