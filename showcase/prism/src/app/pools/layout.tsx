import { ListingSessionProvider } from "@/features/pools/listing-session";
import { PoolsNav } from "@/features/pools/pools-nav";
import type { ReactNode } from "react";

/**
 * The shell every `/pools/*` route renders inside.
 *
 * ## Why the surface needs a layout at all
 *
 * The listing backend is the only thing in Prism that authenticates, and it
 * authenticates with SIWE — a wallet popup. `ListingSessionProvider` holds the
 * one token that answers for every "your" figure on this surface, and
 * `useListingSession()` throws outside it. Mounted per screen, as it was, each
 * new pools route would have to remember to wrap itself, and a reader walking
 * from the catalog to a pool to their rewards would be inside three different
 * providers reading the same persisted token. Hoisting it here makes the
 * session a property of the section rather than of whichever screen happens to
 * be open.
 *
 * The container lives here for the same reason: `/pools` is now six pages, and
 * a width that each screen re-declares is a width that drifts. **Pages under
 * this layout must not wrap themselves in their own `mx-auto max-w-…` shell** —
 * they render straight into this column.
 *
 * This file stays a server component. Only `PoolsNav` needs the pathname, and
 * `ListingSessionProvider` carries its own `"use client"`, so the boundary is
 * as deep as it can be rather than at the top of the tree.
 */
export default function PoolsLayout({ children }: { children: ReactNode }) {
  return (
    <ListingSessionProvider>
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-5">
        <PoolsNav />
        {children}
      </div>
    </ListingSessionProvider>
  );
}
