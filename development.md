# Development and releases

This guide is for maintainers working on this monorepo. SDK consumers should use the [API documentation](https://doc.trading-sdk.symm.io/). Read [AGENTS.md](AGENTS.md) and the rules in the package you are changing before starting implementation.

- [Local development](#local-development)
- [When to release a staging version](#when-to-release-a-staging-version)
- [Prepare a staging release](#prepare-a-staging-release)
- [Configure npm authentication](#configure-npm-authentication)
- [Publish with a stage-only token](#publish-with-a-stage-only-token)
- [Publish directly with Changesets](#publish-directly-with-changesets)
- [Verify and install the release](#verify-and-install-the-release)
- [Repeat testing and release to production](#repeat-testing-and-release-to-production)
- [Troubleshooting](#troubleshooting)

## Local development

Use pnpm, with the version declared in the root [package.json](package.json). The workspace requires Node 20 or newer. For npm's staged publishing flow below, use Node 22.14 or newer in the Node 22 line and npm 11.15 or newer. The examples invoke npm 11.20.0 through pnpm without changing project dependencies or your globally installed npm.

From the repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Framework-independent behavior belongs in `packages/trading-core`; React state and orchestration belong in `packages/trading-react`. Consumer UI belongs in `apps/web`. Document public SDK changes in `apps/docs` in the same change.

| Command                                   | Purpose                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm lint`                               | Lint the workspace.                                                          |
| `pnpm check-types`                        | Check TypeScript across the workspace.                                       |
| `pnpm test`                               | Run package tests; live integration tests have separate opt-in requirements. |
| `pnpm exec prettier --check .`            | Check formatting without rewriting files.                                    |
| `pnpm --filter @symmio/trading-core test` | Run tests for one package.                                                   |
| `pnpm verify-packages`                    | Build packages, check packed output, and test an external consumer.          |
| `pnpm verify-pack`                        | Build and check packed output, skipping the external consumer installation.  |

Add a changeset with `pnpm changeset` when published package behavior or API changes. Commit it with the code. Choose the bump according to compatibility: patch for compatible fixes, minor for compatible additions, major for breaking changes. Docs-only and app-only changes normally do not need an SDK release. See [.changeset/README.md](.changeset/README.md).

## When to release a staging version

Use a staging release when another app or team needs to install SDK changes from npm before those changes are ready for production. Examples include support for a contract or solver API deployed only in staging, testing a new trading flow end to end, or validating the packaged SDK outside this workspace.

Use local workspace development for changes that do not yet need distribution. Release to `latest` only after the affected production integrations work, the required checks pass, and public API documentation is ready. A staging SDK tag does not configure contract addresses or backend URLs: the consuming app still needs the appropriate staging configuration.

Three separate concepts matter:

| Concept                                                    | Meaning                                                                                              |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Prerelease version, such as `3.0.1-staging-20260926093035` | A version that ordinary stable dependency ranges do not select.                                      |
| npm dist-tag `staging`                                     | An install label that points to one published version, selected explicitly with `@staging`.          |
| npm staging area                                           | An approval queue. An uploaded version is not available to consumers until a maintainer approves it. |

Always use a prerelease version **and** the `staging` dist-tag. Publishing plain `3.0.1` with that tag could still make it eligible for stable dependency ranges. A staging release remains public after publication; the tag provides opt-in installation, not access control. See [npm dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/) and [prerelease range matching](https://github.com/npm/node-semver#prerelease-tags).

There is currently no automated staging release workflow in this repo. The [existing release workflow](.github/workflows/release.yml) handles stable releases from `main`. The steps below are manual.

## Prepare a staging release

### 1. Use a disposable release checkout

Commit the source changes and their changesets on the branch you want to test first. A worktree created from `HEAD` includes committed files only. Do not merge staging-only behavior into `main` just to publish a test package.

From that branch, create an isolated checkout. Keep the same terminal for the remaining commands so the shell variables remain available:

```sh
SDK_SOURCE_DIR=$(git rev-parse --show-toplevel)
SDK_STAGE_DIR=$(mktemp -d "${TMPDIR:-/tmp}/symmio-staging.XXXXXX")
git worktree add --detach "$SDK_STAGE_DIR" HEAD
cd "$SDK_STAGE_DIR"
pnpm install --frozen-lockfile
pnpm changeset status
```

Review the packages and bump types in the status output. Snapshot generation consumes pending changesets and changes package versions and changelogs. Keep these generated changes in this disposable checkout; the original branch must retain its changesets for the eventual stable release. [Changesets snapshot guide](https://changesets.dev/guide/snapshot-releases)

### 2. Choose the snapshot base and generate versions

Changesets defaults to a `0.0.0` snapshot base. To use the planned release number, add this top-level field to [.changeset/config.json](.changeset/config.json) **in the release checkout**, preserving its other settings:

```json
{
  "snapshot": {
    "useCalculatedVersion": true
  }
}
```

Starting from `3.0.0`, a patch changeset produces `3.0.1-staging-<timestamp>`; a minor changeset produces `3.1.0-staging-<timestamp>`. The highest pending bump for a package wins. This setting does not force a patch bump; do not relabel breaking changes just to obtain a particular version number. [Changesets configuration](https://changesets.dev/guide/config#snapshot)

```sh
pnpm changeset version --snapshot staging
pnpm install --lockfile-only
git diff -- .changeset packages pnpm-lock.yaml
```

Use `staging` exactly, without a trailing dot. Confirm every package you intend to release has a prerelease version and inspect internal dependency changes.

The remaining examples release core and React together. If the release plan includes another changed package, include it in packaging, publication, and verification too; publish dependencies before their consumers. The packages are not configured to always share a version.

### 3. Validate the release checkout

```sh
pnpm lint
pnpm check-types
pnpm test
pnpm verify-packages
pnpm exec prettier --check .
```

Resolve failures before uploading. `verify-packages` builds the packages and checks their tarballs, declarations, exports, and installation into a separate consumer; it does not publish anything. Staging integration testing still happens in the consuming application.

Record the current tags for comparison after the release:

```sh
pnpm view @symmio/trading-core dist-tags --json
pnpm view @symmio/trading-react dist-tags --json
```

## Configure npm authentication

Choose the publishing route according to your credentials:

| Credential                                                                                          | Route                                                                                                    |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Granular token with **Read and write (stage only)**                                                 | Upload to npm's staging area, then approve with account 2FA. Recommended for this manual token workflow. |
| Granular token with **Read and write (publish and stage)** and **Bypass two-factor authentication** | Direct Changesets publication, if the package's publishing policy permits it.                            |
| Interactive npm login with account 2FA                                                              | Direct publication with the required browser or OTP challenge.                                           |

Grant a token access to the packages being released. Organization-management access alone does not grant package publishing access. A token cannot be restricted to the `staging` dist-tag; even stage-only tokens retain other write capabilities, including moving dist-tags. Bypass 2FA does not turn a stage-only token into a direct-publishing token. [npm token permissions](https://docs.npmjs.com/about-access-tokens/) and [token creation](https://docs.npmjs.com/creating-and-viewing-access-tokens/)

### Which .npmrc file to edit

The project `.npmrc` and your user `~/.npmrc` are different files. An empty project file is normal. Put local credentials in the **user** file; do not commit a real token in the repository.

For example, replace the existing npm registry authentication entry in `~/.npmrc` with an environment-variable reference. Keep only one authentication entry for this registry:

```ini
//registry.npmjs.org/:_authToken=${SYMMIO_NPM_TOKEN}
```

Set the variable in the terminal where you will publish. This Bash/zsh prompt hides your input and avoids putting the token in command history:

```sh
printf 'npm token: '
read -r -s SYMMIO_NPM_TOKEN
printf '\n'
export SYMMIO_NPM_TOKEN
```

Supply the variable whenever you use this configuration. For interactive login instead, remove the token reference and let login manage the user authentication entry. Project configuration can override user configuration, so check both files if the wrong credentials are used. [npmrc documentation](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc/)

## Publish with a stage-only token

Use this route for `E_STAGE_REQUIRED`. It requires npm 11.15 or newer and Node 22.14 or newer in the Node 22 line. The package must already exist on npm, and a maintainer must have 2FA enabled to approve it. [npm staged publishing](https://docs.npmjs.com/staged-publishing/)

### 1. Pack with pnpm

From the prepared release checkout:

```sh
SDK_STAGE_TARBALLS=$(mktemp -d "${TMPDIR:-/tmp}/symmio-staging-tarballs.XXXXXX")
SDK_CORE_VERSION=$(node -p "require('./packages/trading-core/package.json').version")
SDK_REACT_VERSION=$(node -p "require('./packages/trading-react/package.json').version")

pnpm --dir packages/trading-core pack --pack-destination "$SDK_STAGE_TARBALLS"
pnpm --dir packages/trading-react pack --pack-destination "$SDK_STAGE_TARBALLS"

tar -xOf "$SDK_STAGE_TARBALLS/symmio-trading-react-$SDK_REACT_VERSION.tgz" package/package.json
```

Inspect React's packed dependency on core: it must reference the intended snapshot version, and no runtime dependency should retain `workspace:`. pnpm rewrites workspace ranges during packing. Upload the resulting tarballs, rather than asking npm to pack the workspace directories. [pnpm workspace publication](https://pnpm.io/10.x/workspaces#publishing-workspace-packages)

### 2. Upload both tarballs with the staging tag

These commands upload artifacts for approval; they do not immediately make them installable:

```sh
pnpm dlx npm@11.20.0 stage publish "$SDK_STAGE_TARBALLS/symmio-trading-core-$SDK_CORE_VERSION.tgz" --tag staging --access public
pnpm dlx npm@11.20.0 stage publish "$SDK_STAGE_TARBALLS/symmio-trading-react-$SDK_REACT_VERSION.tgz" --tag staging --access public
```

The npm CLI is invoked through pnpm only for the registry's staging API. Continue using pnpm for installing, building, and packing the workspace. The dist-tag is recorded when the artifact is staged and cannot be changed on that pending stage. [npm stage command](https://docs.npmjs.com/cli/v11/commands/npm-stage/#tag-behavior)

### 3. Review and approve

Open **Staged Packages** on npmjs.com. Review the package names, snapshot versions, and `staging` tag. Approve core first, then React, completing the 2FA challenge. If other workspace dependencies are included, approve those before their consumers too.

For CLI inspection:

```sh
pnpm dlx npm@11.20.0 stage list @symmio/trading-core
pnpm dlx npm@11.20.0 stage list @symmio/trading-react
```

Approval publishes the staged artifacts under their recorded tag. A pending stage alone cannot be installed by a consumer. [Review and approval](https://docs.npmjs.com/staged-publishing/#approve-a-staged-package)

## Publish directly with Changesets

Use this alternative only with credentials that allow direct publication. From the validated release checkout:

```sh
pnpm exec changeset publish --tag staging --no-git-tag
```

If using account 2FA with a one-time code, replace `YOUR_CODE` with the current code:

```sh
pnpm exec changeset publish --tag staging --no-git-tag --otp=YOUR_CODE
```

Changesets publishes unpublished local package versions, so review the entire release plan, not only core and React. The `--no-git-tag` option avoids creating release Git tags for disposable snapshots. [Changesets publish options](https://changesets.dev/guide/cli#publish)

Do not use the bare root `pnpm changeset:publish` script for staging: its final publish command has no staging tag. The current GitHub release workflow also uses that script for stable publication.

npm documents the end of direct publishing with granular access tokens for January 2027. Recheck the policy before relying on that route; the staged-upload route above supports stage-only tokens. [npm token policy](https://docs.npmjs.com/about-access-tokens/#direct-publishing-is-being-deprecated)

## Verify and install the release

After direct publication or approval, verify both packages:

```sh
pnpm view @symmio/trading-core@staging version
pnpm view @symmio/trading-react@staging version
pnpm view @symmio/trading-core dist-tags --json
pnpm view @symmio/trading-react dist-tags --json
```

Check that `staging` points to the intended snapshots and `latest` still points to the stable versions recorded earlier. Record the source commit and exact published versions with the staging test results.

In the **separate consuming application's** directory:

```sh
pnpm add --save-exact @symmio/trading-core@staging @symmio/trading-react@staging
```

Commit the consumer's dependency and lockfile changes. Exact versions and a lockfile make the tested build reproducible. Installing from this monorepo can resolve workspace packages instead of exercising npm output, so use the external consumer for release validation. [pnpm add](https://pnpm.io/10.x/cli/add)

## Repeat testing and release to production

For another staging iteration, commit the next source changes on the development branch and create a fresh release checkout from that commit. Generate a new timestamped snapshot from its original stable package versions and pending changesets. Do not generate the next release from an already-consumed snapshot checkout.

For an authentication-only failure, keep the existing snapshot version and built artifacts. Fix authentication and retry only the failed upload/publication. If an upload succeeded but approval did not, find and approve the existing stage. Published versions cannot be overwritten; code changes need a new version. Do not merge snapshot versions, generated changelogs, lockfile edits, or consumed-changeset deletions into the development branch. Preserve any intentional source changes before removing the disposable worktree.

When production is ready:

1. Verify compatibility with production contracts and services, run the required checks, and finish the public API docs.
2. Merge the source changes and original changesets to `main`.
3. Review and merge the **Version Packages** PR generated by the existing release workflow.
4. Approve the GitHub **release** environment when requested. Confirm its npm credentials permit the workflow's direct publish operation; a stage-only token needs an adapted workflow and a separate npm approval.
5. Verify the stable versions on `latest`, then update consumers to those versions.

Release a normal stable version through this process; do not move `latest` to a staging snapshot. GitHub environment approval and npm staged-package approval are separate gates. This guide does not change the existing GitHub workflow.

## Troubleshooting

| Symptom                                     | Meaning and next step                                                                                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snapshot starts with `0.0.0`                | The default snapshot base is active. Set `snapshot.useCalculatedVersion` before versioning a fresh release checkout.                                                                        |
| Expected `3.0.1`, got `3.1.0`               | A pending changeset requests a minor bump. Review the release plan and compatibility; the snapshot tag does not control the bump.                                                           |
| Version contains `staging.`                 | The snapshot name included a trailing dot. Use exactly `--snapshot staging` next time.                                                                                                      |
| No packages to version                      | Check that the source commit contains pending changesets. A previous version command may already have consumed them.                                                                        |
| E403: 2FA or bypass token required          | Direct publication needs valid interactive 2FA or an allowed direct-publish token with bypass enabled. A successful login alone does not establish package publish permission.              |
| E403: GET `/-/npm/v1/user`                  | Changesets' profile check was denied. If it continues to publication, inspect the later publish error for the actual blocker; do not broaden permissions just to silence the profile check. |
| `E_STAGE_REQUIRED`                          | The token cannot publish directly. Use the stage-only flow; `--tag staging` does not satisfy this permission.                                                                               |
| Unknown `stage` command                     | The npm CLI is too old. Use the pinned npm invocation above with a supported Node version.                                                                                                  |
| Empty `.npmrc`                              | Confirm whether you opened the project file or the user file. Local registry authentication belongs in the user file.                                                                       |
| Consumer cannot install the version         | Confirm all needed packages are approved/published and `staging` points to those versions. An npm stage awaiting approval is not installable.                                               |
| Version already exists or is already staged | Inspect the existing package/stage. Do not retry with different contents under the same published version. Generate a fresh snapshot for changed code.                                      |

For current authentication and staging behavior, consult the linked npm documentation; registry policy can change independently of this repository.
