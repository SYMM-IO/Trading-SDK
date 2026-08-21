"use client";

import { Button, type ButtonProps } from "@/components/button";
import type { Deployment } from "@/config/deployments";
import { useChainGate } from "@/features/wallet/use-chain-gate";

export interface GatedSubmitProps {
  /** The deployment the write lands on. Its chain is what the wallet must be on. */
  deployment: Deployment;
  label: string;
  onSubmit: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

/**
 * A submit button that becomes a network switch when the wallet is elsewhere.
 *
 * Prism reads two chains at once, so the wallet is on the wrong one for half the
 * screen at any moment. Rendering a disabled submit there would be a lie: the
 * action is available, the wallet just has to move first. This renders the real
 * next step instead.
 */
export function GatedSubmit({
  deployment,
  label,
  onSubmit,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
  className,
}: GatedSubmitProps) {
  const gate = useChainGate(deployment);

  if (gate.needsSwitch) {
    return (
      <Button
        variant="secondary"
        size={size}
        loading={gate.isSwitching}
        onClick={() => void gate.switchToDeployment()}
        className={className}
      >
        {gate.isSwitching ? null : (
          <span
            aria-hidden
            className="size-[6px] shrink-0 rounded-full"
            style={{ background: `var(${deployment.chainColorVar})` }}
          />
        )}
        Switch to {deployment.chainName}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      loading={loading}
      disabled={disabled}
      onClick={onSubmit}
      className={className}
    >
      {label}
    </Button>
  );
}
