"use client";

import { fadeUp, inViewOnce, staggerContainer, staggerItem } from "@/lib/motion";
import { motion } from "motion/react";

/** Three qualities of the program, stated plainly under the hero. */
const HIGHLIGHTS = [
  { title: "Deterministic address", body: "Your affiliate address is derived up front — known before you submit." },
  { title: "Programmable fee split", body: "Route fees across any set of stakeholders and the protocol." },
  { title: "Open registration", body: "Anyone can request. An admin approves to activate." },
];

/**
 * The affiliate page hero — a thesis, not a banner. Opens with the most
 * characteristic thing about registering: you become addressable on-chain. The
 * accent word carries the site's coral text-sheen so the primary reads as
 * charged rather than flat.
 */
export function AffiliateHero() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
      <motion.span
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="border-border/70 bg-muted/30 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase"
      >
        <span className="bg-primary size-1.5 rounded-full" aria-hidden />
        SYMMIO Affiliate Program
      </motion.span>

      <motion.h1
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.06 }}
        className="font-display text-foreground text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
      >
        Become a SYMMIO <span className="text-sheen">affiliate</span>
      </motion.h1>

      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.12 }}
        className="text-muted-foreground max-w-2xl text-lg leading-8 text-pretty"
      >
        Register your details on-chain to claim a deterministic affiliate address and route protocol fees to your
        stakeholders. Submit the request below, then get approved to go live.
      </motion.p>

      <motion.dl
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={inViewOnce}
        className="mt-4 grid w-full gap-3 sm:grid-cols-3"
      >
        {HIGHLIGHTS.map((item) => (
          <motion.div
            key={item.title}
            variants={staggerItem}
            className="border-border/60 bg-card/50 flex flex-col gap-1.5 rounded-xl border p-4 text-left"
          >
            <dt className="text-foreground text-sm font-semibold">{item.title}</dt>
            <dd className="text-muted-foreground text-xs leading-5">{item.body}</dd>
          </motion.div>
        ))}
      </motion.dl>
    </section>
  );
}
