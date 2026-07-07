"use client";

import { fadeUp, inViewOnce, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@symmio/ui/lib/utils";
import { motion } from "motion/react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Extra delay before this element rises in, in seconds. */
  delay?: number;
}

/**
 * Fade-and-rise a single element the first time it scrolls into view. Wraps a
 * `motion.div`; `prefers-reduced-motion` is honored by `motion` automatically.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Container that reveals its {@link StaggerItem} children one after another as
 * the group scrolls into view — used for the library and app card grids.
 */
export function Stagger({ children, className, ...rest }: ComponentPropsWithoutRef<typeof motion.div>) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={inViewOnce}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** A single member of a {@link Stagger} group. */
export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerItem} className={cn(className)}>
      {children}
    </motion.div>
  );
}
