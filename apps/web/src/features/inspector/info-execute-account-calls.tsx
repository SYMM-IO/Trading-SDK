import { MethodCard } from "./method-card";

/** How a React app sends the call itself, since `@symmio/trading-react` has no hook for it. */
const REACT_EXAMPLE = `import { executeAccountCallsMutationOptions } from "@symmio/trading-core";
import { useSymmioConfig } from "@symmio/trading-react";
import { useMutation } from "@tanstack/react-query";

const config = useSymmioConfig();
const { mutate } = useMutation(executeAccountCallsMutationOptions(config));

mutate({
  account: subAccount,
  calls: [
    { functionName: "deallocate", args: [amount18, upnlSig] },
    { functionName: "initiateWithdraw", args: [parts, false, providerData] },
  ],
});
// Wait for the receipt, then refresh the reads these calls changed.`;

/**
 * Reference card for `executeAccountCalls`. It explains the call and sends
 * nothing: this app reaches the SDK only through `@symmio/trading-react`, which
 * has no hook for it, because its calls are arbitrary core writes and no fixed
 * set of reads can be refreshed after them.
 */
export function InfoExecuteAccountCalls() {
  return (
    <MethodCard
      testId="method-executeAccountCalls"
      name="executeAccountCalls"
      mutability="nonpayable"
      wide
      description="Run several SYMMIO core writes as one subaccount, in one atomic transaction. Reference only: this card explains the call and sends nothing."
    >
      <section className="space-y-2 text-sm" data-testid="info-execute-account-calls-how">
        <h3 className="font-medium">How it works</h3>
        <ol className="text-muted-foreground list-decimal space-y-1 pl-5 leading-6">
          <li>
            Pass a subaccount and an ordered list of <code className="font-mono">{"{ functionName, args }"}</code>. Each
            name must be a write in the SDK’s SYMMIO core ABI, with its own units.
          </li>
          <li>The SDK encodes every call first, so a wrong name or argument fails before any wallet prompt.</li>
          <li>
            From the wallet, the calls go out as one AccountLayer <code className="font-mono">_call</code> transaction,
            simulated first. If one call reverts, none of them happen.
          </li>
          <li>
            Gasless, every call is relayed in order as one request. With{" "}
            <code className="font-mono">gasless: true</code>, a list holding a call the relayer cannot carry is refused
            instead of going to the wallet.
          </li>
          <li>
            Nothing is inferred: no request ids, and no call’s return value is fed into the next. Read what you need
            before you build the list.
          </li>
        </ol>
      </section>

      <section className="space-y-2 text-sm" data-testid="info-execute-account-calls-why">
        <h3 className="font-medium">Why this card cannot send it</h3>
        <p className="text-muted-foreground leading-6">
          This app uses the SDK only through <code className="font-mono">@symmio/trading-react</code>, and that package
          has no hook for this call: the calls are arbitrary core writes, so no fixed set of reads can be refreshed
          after them. For a withdrawal you do not need it: the <code className="font-mono">useWithdraw</code> flow
          already deallocates and initiates in one atomic transaction on a cross-margin subaccount.
        </p>
      </section>

      <section className="space-y-2 text-sm" data-testid="info-execute-account-calls-example">
        <h3 className="font-medium">In a React app</h3>
        <pre className="bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs leading-5">
          <code>{REACT_EXAMPLE}</code>
        </pre>
        <p className="text-muted-foreground text-xs">
          Full reference: SDK docs → Core → SYMMIO contract → executeAccountCalls.
        </p>
      </section>
    </MethodCard>
  );
}
