#!/usr/bin/env node
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "ink";
import { useState } from "react";
import { DeploymentProvider, useDeployment } from "./config/deployment-context.js";
import "./config/load-env.js";
import "./config/safety.js";
import { AppStateProvider } from "./features/app-state.js";
import { App } from "./features/app.js";
import { ToastProvider } from "./features/toast.js";
import { createAppQueryClient } from "./sdk/query-client.js";
import { NotificationsProvider } from "./sdk/use-notifications.js";
import { PricesProvider } from "./sdk/use-prices.js";
import { SubAccountProvider } from "./sdk/use-sub-accounts.js";
import { MouseProvider } from "./ui/mouse.js";
import { walletHub } from "./wallet/wallet-hub.js";

/**
 * The provider tree. Query cache and the live sockets (prices, notifications)
 * sit above the shell so they persist across tab switches; `SubAccountProvider`
 * feeds the account context every data hook depends on.
 */
function Root() {
  return (
    <MouseProvider>
      <DeploymentProvider>
        <AppStateProvider>
          <RuntimeProviders />
        </AppStateProvider>
      </DeploymentProvider>
    </MouseProvider>
  );
}

/** Remount all data providers when the SDK environment changes. */
function RuntimeProviders() {
  const { environment } = useDeployment();
  return <EnvironmentProviders key={environment} />;
}

/** Owns one isolated query cache and socket tree for the active environment. */
function EnvironmentProviders() {
  const [queryClient] = useState(createAppQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SubAccountProvider>
        <PricesProvider>
          <NotificationsProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </NotificationsProvider>
        </PricesProvider>
      </SubAccountProvider>
    </QueryClientProvider>
  );
}

await walletHub.initFromEnv();
const app = render(<Root />, { alternateScreen: true });
await app.waitUntilExit();

// Some SDK transports retain reconnect timers after React has unmounted. Ink
// has already restored the terminal at this point, so terminate explicitly
// instead of leaving `q` waiting on transport-owned handles.
process.exit(0);
