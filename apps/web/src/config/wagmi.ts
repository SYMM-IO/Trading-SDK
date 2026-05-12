import { createConfig, http } from "wagmi";
import { hyperEvm } from "wagmi/chains";

export const wagmiConfig = createConfig({
  chains: [hyperEvm],
  transports: {
    [hyperEvm.id]: http(),
  },
});
