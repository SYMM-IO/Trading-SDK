import type { Address } from "viem";
import type { SymmioNotificationsProtocol } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";

/**
 * Inputs for {@link buildSubscribeMessage}.
 */
export interface BuildSubscribeMessageParameters {
  /** SubAccount address to subscribe for. */
  account: Address;
  /** Channel / `app_name` configured for the endpoint. */
  channel: string;
  /** Wire protocol the endpoint speaks. */
  protocol: SymmioNotificationsProtocol;
}

/**
 * Build the subscribe frame to send on (re)connect for a notifications endpoint.
 *
 * For `defilytics`, this is a `channel_patterns` frame scoped to the account
 * with wildcard identifiers (every quote id for the account).
 *
 * @returns The frame serialized as a JSON string, ready to send.
 * @throws {SymmError} for an unsupported protocol.
 */
export function buildSubscribeMessage(parameters: BuildSubscribeMessageParameters): string {
  switch (parameters.protocol) {
    case "defilytics":
      return JSON.stringify({
        channel_patterns: [
          {
            app_name: parameters.channel,
            address: parameters.account,
            primary_identifier: "*",
            secondary_identifier: "*",
          },
        ],
      });
    default:
      throw new SymmError(
        "config",
        "UNSUPPORTED_NOTIFICATIONS_PROTOCOL",
        `Unsupported notifications protocol: ${parameters.protocol}`,
      );
  }
}
