"use client";

import { CodePane } from "@/features/hero/code-pane";
import { heroExamples } from "@/features/hero/hero-examples";
import { easeOut } from "@/lib/motion";
import { cn } from "@symmio/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

const AUTO_ADVANCE_MS = 5200;

/**
 * The hero's right column — a crossfading reel of "code → UI" examples that show
 * what the SDK builds: an order ticket, a positions table, an account panel.
 *
 * All slides are stacked in one grid cell so the reel is exactly as tall as its
 * content and switches transition *in place* (opacity + a faint scale/blur
 * morph), never sliding off-screen. The order ticket assembles and tucks over
 * the snippet's lower-right corner. Auto-advances, pauses on hover, and holds
 * still under `prefers-reduced-motion`.
 */
export function HeroShowcase() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = heroExamples.length;

  useEffect(() => {
    if (paused || reduce) return;
    const id = window.setInterval(() => setActive((current) => (current + 1) % count), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [paused, reduce, count]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: easeOut, delay: 0.1 }}
      className="flex flex-col gap-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="grid grid-cols-1 perspective-[1600px]">
        {heroExamples.map((example, index) => {
          const isActive = index === active;
          const { Panel } = example;
          return (
            <motion.div
              key={example.id}
              style={{ gridArea: "1 / 1" }}
              initial={false}
              animate={{
                opacity: isActive ? 1 : 0,
                scale: reduce ? 1 : isActive ? 1 : 0.97,
                filter: reduce ? "none" : isActive ? "blur(0px)" : "blur(3px)",
              }}
              transition={{ duration: 0.55, ease: easeOut }}
              className={cn("min-w-0", isActive ? "relative z-10" : "pointer-events-none")}
              aria-hidden={!isActive}
            >
              <div className="relative">
                <div className="relative z-10 lg:pr-8">
                  <CodePane filename={example.filename} lines={example.lines} animate={index === 0} />
                </div>
                <div className="relative z-20 mx-auto -mt-6 w-full max-w-[320px] sm:max-w-[340px] lg:-mt-24 lg:-mr-6 lg:ml-auto lg:w-[300px]">
                  <Panel />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 lg:pl-1">
        <div className="flex items-center gap-2">
          {heroExamples.map((example, index) => (
            <button
              key={example.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show the ${example.label} example`}
              aria-current={index === active}
              className="focus-visible:ring-ring/50 group rounded-full py-1.5 outline-none focus-visible:ring-2"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all duration-300",
                  index === active
                    ? "bg-primary w-6"
                    : "bg-muted-foreground/30 group-hover:bg-muted-foreground/60 w-1.5",
                )}
              />
            </button>
          ))}
        </div>
        <span className="text-muted-foreground font-mono text-xs">{heroExamples[active]?.label}</span>
      </div>
    </motion.div>
  );
}
