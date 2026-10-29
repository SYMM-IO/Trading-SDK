# SDK web application

This Next.js app consumes the workspace SDK through its React hooks. When an SDK change affects an existing flow or needs an interactive example, update this app alongside the package and public documentation.

## Timelock integration

Open `/integration?flow=timelock` to check and configure the root policy, request an approval, execute protected account actions and Core batches, or schedule, cancel and execute an exact call. Virtual-account policy and recovery resolve to the root while Core execution preserves the selected account. Setup, Instant Open, Withdraw and the protected inspector cards use the SDK's timelock APIs. An unlocked selector keeps its ordinary write path; a locked withdrawal uses an approval for each locked leg.

- Deployment metadata, selector checks, approval validation and transaction execution come from SDK hooks. No contract or approval implementation is duplicated in the app.
- A complete on-chain policy does not prove solver indexing. There is no indexing-status endpoint configured here. The console requires explicit acknowledgement of independent indexing verification; it never spends an approval to probe readiness.
- The early-withdrawal card uses the owner wallet and inherits configured gasless dispatch. Its five-minute request deadline is an application choice, separate from the solver's advertised approval validity. The card does not deallocate margin; the main Withdraw flow also supports the atomic deallocate-and-initiate path. Core cooldown and finalization still apply to initiation.
- Delayed recovery is an advanced exact-calldata tool, not automatic fallback. Supply the raw operation and matching AccountLayer execution encoding. It uses owner-funded transactions, checks the chain clock, and preserves the exact calldata in browser storage. Policy-change windows use the affected selector delays and assume no approvals. Do not schedule short-lived Muon signatures.
- Browser-local recovery records prevent automatic reissuance after refresh or an unknown result. An operator must reconcile uncertain transactions/approvals before clearing a record. A confirmed scheduled operation can be continued or cancelled. This is console behavior, not SDK persistence policy.
- Inspector cards for allocation, deallocation, margin, deletion and fee allowance detect their selected policy and use an explicit SDK authorization when needed. The named-function card covers all 22 SDK functions with ABI-driven arguments; the exact-call card accepts raw calldata.

`e2e/timelock.read.spec.ts` uses mocked RPC/solver responses to check policy, recovery, approval and receipt paths without broadcasting transactions. Run it with `pnpm --filter @symmio/web exec playwright test e2e/timelock.read.spec.ts`. Real-wallet signing and staging execution remain separate integration checks.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
