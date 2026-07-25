"use client";

import { cn } from "@symmio/ui/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AffiliateHero } from "./affiliate-hero";
import { AffiliateStatus } from "./affiliate-status";
import { RegistrationForm } from "./registration-form";
import { RegistrationSuccess } from "./registration-success";
import { RegistrationSummary } from "./registration-summary";
import { useRegistrationForm } from "./use-registration-form";

/** The two things a visitor can do on this page. */
type Tab = "register" | "status";

/**
 * The affiliate registration experience. Holds the form state once and offers
 * two modes — registering a new affiliate, or checking (and cancelling) an
 * existing one — behind a tab switcher. A fresh registration takes over the whole
 * surface with the pending-approval confirmation, so the tabs stand down while
 * it shows. Celebration fires later on Check status once the affiliate is
 * `ACTIVE`.
 */
export function AffiliateRegister() {
  const api = useRegistrationForm();
  const [tab, setTab] = useState<Tab>("register");

  /** When a registration confirms, bring the pending-approval takeover into view. */
  useEffect(() => {
    if (api.result) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [api.result]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-28 pb-24 sm:px-6 sm:pt-32 lg:px-8">
      <AnimatePresence mode="wait">
        {api.result ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <RegistrationSuccess result={api.result} onRegisterAnother={api.reset} />
          </motion.div>
        ) : (
          <motion.div
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-12 flex justify-center">
              <div
                role="tablist"
                aria-label="Affiliate actions"
                className="border-border/70 bg-card/40 inline-flex rounded-xl border p-1 backdrop-blur-sm"
              >
                {(["register", "status"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="tab"
                    aria-selected={tab === option}
                    onClick={() => setTab(option)}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                      tab === option
                        ? "bg-primary/10 text-primary ring-primary/25 shadow-sm ring-1 ring-inset"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option === "register" ? "Register" : "Check status"}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait">
              {tab === "register" ? (
                <motion.div
                  key="register"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-14"
                >
                  <AffiliateHero />

                  <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
                    <div className="border-border/70 bg-card/40 min-w-0 rounded-2xl border p-5 shadow-sm backdrop-blur-sm sm:p-7">
                      <RegistrationForm api={api} />
                    </div>
                    <RegistrationSummary api={api} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="status"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <AffiliateStatus />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
