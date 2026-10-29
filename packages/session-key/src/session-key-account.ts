import type { PrivateKeyAccount } from "viem/accounts";
import type { SessionKeyOperationSupersededError } from "./errors";

type SigningOperation = SessionKeyOperationSupersededError["operation"];

/** Keep every signing entry point tied to the manager's current capability. */
export function createSessionKeyAccount(
  account: PrivateKeyAccount,
  assertCanSign: (operation: SigningOperation) => void,
): PrivateKeyAccount {
  /** Re-check after the await: the key can be rotated or cleared while the signature is produced. */
  async function guard<T>(operation: SigningOperation, sign: () => Promise<T>): Promise<T> {
    assertCanSign(operation);
    const signature = await sign();
    assertCanSign(operation);
    return signature;
  }

  return {
    type: account.type,
    source: account.source,
    address: account.address,
    publicKey: account.publicKey,
    sign: (parameters) => guard("sign", () => account.sign(parameters)),
    signMessage: (parameters) => guard("signMessage", () => account.signMessage(parameters)),
    signTypedData: (parameters) => guard("signTypedData", () => account.signTypedData(parameters)),
    signAuthorization: (parameters) => guard("signAuthorization", () => account.signAuthorization(parameters)),
    signTransaction: (transaction, options) =>
      guard("signTransaction", () => account.signTransaction(transaction, options)),
  };
}
