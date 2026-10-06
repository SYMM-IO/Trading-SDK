# SEO manual checklist — SYMMIO Trading-SDK sites

The non-code steps for getting these three sites indexed and ranking in Google, Bing and AI search:

- [trading-sdk.symm.io](https://trading-sdk.symm.io/) (landing)
- [console.trading-sdk.symm.io](https://console.trading-sdk.symm.io/) (console)
- [doc.trading-sdk.symm.io](https://doc.trading-sdk.symm.io/) (docs)

The code changes live on branch `feat/seo-discoverability`: robots.txt, sitemaps, canonical URLs, social cards, structured data, unique docs descriptions and cross-links.

Work top to bottom. Steps 1–3 matter most, and step 4 matters most for the query "symmio sdk".

---

## 0. Ship the code first

- [ ] Merge and deploy `feat/seo-discoverability` to all three Vercel projects.
- [ ] Check that each of these opens (HTTP 200, not the 404 page):
  - https://trading-sdk.symm.io/robots.txt and https://trading-sdk.symm.io/sitemap.xml
  - https://console.trading-sdk.symm.io/robots.txt and https://console.trading-sdk.symm.io/sitemap.xml
  - https://doc.trading-sdk.symm.io/robots.txt and https://doc.trading-sdk.symm.io/sitemap.xml
- [ ] In each home page's "View source", check for `<link rel="canonical"`, `og:image` and `application/ld+json`.

## 1. Google Search Console (highest impact)

- [ ] Ask the SYMMIO team whether a Search Console **Domain property** for `symm.io` already exists.
  - If it does, ask an owner to add you (Settings → Users and permissions), then skip to the sitemap step.
- [ ] Otherwise, create it at https://search.google.com/search-console:
  1. Add property → **Domain** → `symm.io`.
  2. Copy the `google-site-verification=…` TXT value.
  3. Add a **TXT** record on the root of `symm.io` (host `@`) at the DNS provider.
  4. Click Verify. DNS can take a few minutes up to a few hours.
  - One Domain property covers every subdomain, including all three sites.
- [ ] **Sitemaps** → submit all three:
  - `https://trading-sdk.symm.io/sitemap.xml`
  - `https://console.trading-sdk.symm.io/sitemap.xml`
  - `https://doc.trading-sdk.symm.io/sitemap.xml`
- [ ] **URL Inspection** → paste each URL → **Request indexing**. The quota is about 10 a day, so start with these:
  - https://trading-sdk.symm.io/
  - https://doc.trading-sdk.symm.io/
  - https://console.trading-sdk.symm.io/
  - https://doc.trading-sdk.symm.io/introduction/
  - https://doc.trading-sdk.symm.io/core/
  - https://doc.trading-sdk.symm.io/react/
  - https://doc.trading-sdk.symm.io/guides/build-a-dex/
- [ ] About a week later:
  - Check **Indexing → Pages → "Why pages aren't indexed"**.
  - In URL Inspection, check that the **user-declared canonical** matches the **Google-selected canonical**.

## 2. Bing Webmaster Tools

Bing's index also feeds DuckDuckGo, Yahoo, Ecosia, ChatGPT search and Copilot.

- [ ] Go to https://www.bing.com/webmasters → **Import from Google Search Console**. This verifies the sites once step 1 is done.
- [ ] Submit the same three sitemaps.

## 3. DNS and Vercel

- [ ] Add `docs.trading-sdk.symm.io`, which people and AI assistants tend to guess. It doesn't resolve today.
  1. Add a DNS **CNAME** `docs.trading-sdk` → the target Vercel shows (usually `cname.vercel-dns.com`).
  2. In the **docs** Vercel project → Settings → Domains → add `docs.trading-sdk.symm.io`.
  3. Set it to **Redirect to** `doc.trading-sdk.symm.io` with a 308.
- [ ] Redirect each project's `*.vercel.app` production domain to its custom domain (Settings → Domains → Edit → Redirect), if Vercel lets you edit it. Today these serve indexable duplicates:
  - `symm-frontier-landing.vercel.app` → `trading-sdk.symm.io`
  - `symm-frontier-web.vercel.app` → `console.trading-sdk.symm.io`
  - the docs project's `*.vercel.app` domain, if it has one → `doc.trading-sdk.symm.io`
  - The new canonical tags already tell Google which host is the real one. The redirect removes any doubt.

## 4. docs.symm.io — the page that already ranks for "symmio sdk"

This is the biggest single lever for that query. The SYMMIO GitBook page for the old SDK ranks today. If it points to the Trading-SDK, the traffic it gets comes to us.

- [ ] Ask the docs.symm.io owner to update https://docs.symm.io/exchange-builder-documentation/frontend-builder-sdk with a banner at the top. Suggested text:

  > **This SDK has been superseded by the SYMMIO Trading-SDK.** New integrations should use `@symmio/trading-core` and `@symmio/trading-react` — see [trading-sdk.symm.io](https://trading-sdk.symm.io/) and the [Trading-SDK documentation](https://doc.trading-sdk.symm.io/).

- [ ] Ask them to add a "Trading-SDK" entry (linking https://doc.trading-sdk.symm.io/) to the docs.symm.io navigation, next to the Frontend Builder SDK page.

## 5. GitHub

- [ ] **`SYMM-IO/frontend-sdk`** (the old SDK):
  1. Add the same banner at the top of its README.
  2. In About → Website, set `https://trading-sdk.symm.io/` (today it is `cloverfield-frontend-sdk.vercel.app`).
  3. Archive the repository (Settings → Archive).
- [ ] **`SYMM-IO/Trading-SDK`** → About (the gear icon):
  - Description: `Official TypeScript SDK for SYMMIO — @symmio/trading-core + React hooks. Docs: https://doc.trading-sdk.symm.io/`
  - Website: `https://trading-sdk.symm.io/` (already set)
  - Topics: `symmio`, `sdk`, `typescript`, `react`, `defi`, `perpetuals`, `derivatives`, `trading`, `arbitrum`, `base`, `viem`, `wagmi`
- [ ] **SYMM-IO org profile** (https://github.com/SYMM-IO):
  - Pin `Trading-SDK` (Customize your pins).
  - If the org has a profile README (`SYMM-IO/.github` → `profile/README.md`), add a line linking the SDK site and docs.

## 6. npm (the next release)

- [ ] When the next "Version Packages" PR appears, merge it (it includes the `npm-docs-homepage` changeset) and approve the `release` publish.
- [ ] Check that https://www.npmjs.com/package/@symmio/trading-core shows **Homepage → doc.trading-sdk.symm.io/core/** and the new keywords. Do the same for `@symmio/trading-react`, `@symmio/utils` and `@symmio/session-key`.

## 7. symm.io main site

- [ ] symm.io already links to the landing. Ask for a **Docs** or **Developers** link to https://doc.trading-sdk.symm.io/ as well, in the header or footer.

## 8. Backlinks and announcement (ongoing)

- [ ] Announce the SDK from @symm_io on X and in the SYMMIO Discord, linking the landing and the docs.
- [ ] Publish a launch or tutorial post (blog, Medium, Mirror or dev.to) that links the docs' [Build a Perps DEX](https://doc.trading-sdk.symm.io/guides/build-a-dex/) guide.
- [ ] List the SDK wherever SYMMIO is listed: Arbitrum and Base ecosystem portals, relevant "awesome" lists.
- [ ] Ask frontends and partners building on SYMMIO to link the SDK docs from their "built with" or docs pages.

## 9. Monitor (weekly for the first month)

- [ ] Google `site:trading-sdk.symm.io`, `site:doc.trading-sdk.symm.io` and `site:console.trading-sdk.symm.io`. Each should return pages.
- [ ] In Search Console → **Performance**, watch impressions and clicks for "symmio sdk", "symmio trading sdk" and "@symmio/trading-core".
- [ ] Run the [Rich Results Test](https://search.google.com/test/rich-results) on the three home pages. They should have no errors.
- [ ] Run [PageSpeed Insights](https://pagespeed.web.dev/) on https://trading-sdk.symm.io/. LCP and the SEO score should be green.
- [ ] Paste the three URLs into an X post draft, LinkedIn Post Inspector or Slack to check the preview card.

---

## What to expect

- **Indexing:** usually within days of submitting the sitemaps and requesting indexing.
- **Branded searches** ("symmio trading sdk", "@symmio/trading-core", SDK method names): typically within 1–4 weeks.
- **"symmio sdk":** docs.symm.io may keep the top spot because its domain is older and stronger. That's fine once step 4 makes it point to us.
- **Generic searches** ("perps sdk", "trading sdk"): a long-term content and backlinks effort, with no guaranteed #1.
