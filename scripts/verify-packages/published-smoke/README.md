# published-smoke

Fixtures for **Layer 2** of `verify-packages` — a throwaway "external consumer" that installs the workspace packages **from their packed tarballs** and proves they actually resolve, typecheck, and import the way a real npm user sees them.

## Why this exists

Inside the monorepo every `@symmio/*` import resolves through pnpm's `workspace:*` symlinks straight to each package's `src/`. That path **never touches** the compiled `dist/`, the generated `.d.ts`, or the `package.json` `exports`/`files` manifest — so a broken published shape (a subpath declared in `exports` with no emitted file, a `.d.ts` that imports a missing specifier under `nodenext`, a file left out of `files`) is invisible to normal `build` / `check-types`.

This folder is that missing check: it stands in for a consumer **outside** the workspace that only has the tarballs.

## How it runs

Driven by [`../verify-packages.mjs`](../verify-packages.mjs) (`verifyConsumer`), which:

1. Copies this folder into a temp dir outside the repo.
2. Writes a generated `package.json` there whose `dependencies` point at the freshly packed `file:*.tgz` tarballs, plus the real peers (`react`, `react-dom`, `viem`, `wagmi`).
3. Runs `pnpm install --ignore-workspace` (no symlinks — the tarballs are installed like registry packages).
4. **Type check** — `tsc --noEmit` under strict `nodenext` (see [`tsconfig.json`](./tsconfig.json)) over the `*.ts` / `*.tsx` fixtures below.
5. **Runtime check** — `node runtime-probe.mjs`.

Both checks are needed because they catch different defects:

- `tsc` resolves the **`.d.ts`** for the root + every subpath. It fails on a bad type-resolution shape — but it **passes** if a `.d.ts` is present while its `.js` twin is missing from the tarball.
- `runtime-probe.mjs` actually `import()`s every entrypoint in Node ESM, so that missing-`.js` case surfaces as `ERR_MODULE_NOT_FOUND` at runtime.

## Files

| File                | Role                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core.ts`           | Type-resolves `@symmio/trading-core` root under `nodenext`.                                                                                                                                               |
| `react.tsx`         | Type-resolves `@symmio/trading-react` root **and all nine subpath exports**, and exercises React types via `react-jsx`. Regression guard for the subpaths that once shipped a `.d.ts` with no `.js` twin. |
| `session.ts`        | Type-resolves `@symmio/session-key` root.                                                                                                                                                                 |
| `utils.ts`          | Type-resolves `@symmio/utils` root and every subpath (`address`, `amounts`, `decimal`, `format`).                                                                                                         |
| `runtime-probe.mjs` | Runtime-`import()`s every published entrypoint (root + subpaths) and exits non-zero if any fails to load.                                                                                                 |
| `tsconfig.json`     | Self-contained strict `nodenext` config; no `extends`, so it stays valid once copied to the temp consumer.                                                                                                |

The consumer's `package.json` and `node_modules` are **generated at run time** — they are not committed here.

## Running it

From the repo root:

```bash
pnpm verify-packages   # full run: Layer 1 (publint + attw) + Layer 2 (this folder)
pnpm verify-pack       # Layer 1 only (offline, fast) — skips this folder
```

Namespace imports (`import * as x`) are deliberate: the fixtures must fail on a **packaging/type-resolution** defect, not on a renamed named export.

## When you add a package or subpath export

Keep three places in sync, or the smoke test won't cover the new surface:

1. Add / extend the matching fixture here (`*.ts` / `*.tsx`) so `tsc` resolves it.
2. Add the specifier to the `specs` array in `runtime-probe.mjs` so it's runtime-imported.
3. If it's a whole new package, register it in `RUNTIME_PACKAGES` in [`../verify-packages.mjs`](../verify-packages.mjs).
