import type { TimelockAuthorization } from "@symmio/trading-core";
import type { Address } from "viem";

/** Match the approval signer to the selected session key for a gasless write. */
export function withSelectedApprovalSigner(
  authorization: TimelockAuthorization | undefined,
  write: { gasless?: boolean; from?: Address },
): TimelockAuthorization | undefined {
  if (!authorization || !("capability" in authorization) || write.gasless !== true || !write.from) return authorization;
  return { ...authorization, approvalSigner: write.from };
}
