#!/usr/bin/env bash
#
# Deploy Prism to Vercel from a local machine — no CI/CD, no git integration.
#
# Prism's SDK dependencies are vendored tarballs (`file:./vendor/*.tgz`) that are
# not committed, so Vercel cannot install them from a git clone. This script
# sidesteps that entirely: it builds the app locally with `vercel build` and
# uploads only the resulting Build Output (`.vercel/output`) with
# `vercel deploy --prebuilt`. Vercel never runs an install of its own.
#
# One-time setup (interactive, run from this directory):
#   pnpm dlx vercel login
#   pnpm dlx vercel link          # creates ./.vercel/project.json (gitignored)
#
# Usage:
#   ./deploy.sh                   # build + deploy to production
#   ./deploy.sh --preview         # build + deploy to a preview URL
#   ./deploy.sh --refresh-sdk     # rebuild + repack the workspace SDK first
#   ./deploy.sh --skip-install    # reuse the existing node_modules as-is
#
# Environment:
#   VERCEL_TOKEN        non-interactive auth (skips `vercel login`)
#   VERCEL_SCOPE        team/org slug, when the account has more than one
#   VERCEL_CLI_VERSION  pin the CLI, e.g. "vercel@48.2.0" (default "vercel@latest")

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TARGET="production"
REFRESH_SDK=0
SKIP_INSTALL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --preview) TARGET="preview" ;;
    --prod | --production) TARGET="production" ;;
    --refresh-sdk) REFRESH_SDK=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    -h | --help)
      awk 'NR > 2 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "${BASH_SOURCE[0]}"
      exit 0
      ;;
    *)
      echo "deploy.sh: unknown argument '$1' (try --help)" >&2
      exit 2
      ;;
  esac
  shift
done

VERCEL_CLI_VERSION="${VERCEL_CLI_VERSION:-vercel@latest}"

# `pnpm dlx` keeps the CLI out of package.json; it is a tool, not a dependency.
vercel() {
  local args=("$@")
  [ -n "${VERCEL_TOKEN:-}" ] && args+=(--token "$VERCEL_TOKEN")
  [ -n "${VERCEL_SCOPE:-}" ] && args+=(--scope "$VERCEL_SCOPE")
  pnpm dlx "$VERCEL_CLI_VERSION" "${args[@]}"
}

step() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$1" >&2; }
die() {
  printf '\033[1;31m✗ %s\033[0m\n' "$1" >&2
  exit 1
}

# A running `next dev` owns .next; building over it corrupts both the dev server
# and the build output. Prism's dev server is pinned to port 1122.
if command -v ss >/dev/null 2>&1 && [ -n "$(ss -ltnH "sport = :1122" 2>/dev/null)" ]; then
  die "port 1122 is in use — stop 'pnpm dev' before building, it shares .next with this build"
fi

if [ ! -f .vercel/project.json ]; then
  die "no .vercel/project.json — run 'pnpm dlx vercel login' then 'pnpm dlx vercel link' in $(pwd) first"
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -gt 22 ]; then
  warn "local Node is v$NODE_MAJOR; Vercel's newest runtime is 22.x. The runtime comes from the project settings pulled below, but if the deploy rejects the build output, set Node.js Version to 22.x in the Vercel project settings."
fi

# The vendored tarballs are gitignored build artifacts, so a fresh checkout has
# none of them and no install can succeed until they are packed.
for pkg in trading-core trading-react utils session-key; do
  if [ ! -f "vendor/symmio-$pkg.tgz" ]; then
    warn "vendor/symmio-$pkg.tgz is missing — repacking the SDK"
    REFRESH_SDK=1
    break
  fi
done

if [ "$REFRESH_SDK" -eq 1 ]; then
  step "Rebuilding and repacking the workspace SDK into vendor/"
  # sdk:refresh ends in its own `pnpm install`, which also rewrites the tarball
  # integrity hashes in pnpm-lock.yaml. Commit that lockfile change.
  pnpm sdk:refresh
elif [ "$SKIP_INSTALL" -eq 0 ]; then
  step "Installing dependencies"
  pnpm install --frozen-lockfile || die "install failed — if pnpm reports an outdated lockfile, the vendored tarballs no longer match it; rerun as './deploy.sh --refresh-sdk'"
fi

step "Pulling Vercel project settings ($TARGET)"
vercel pull --yes --environment="$TARGET"

step "Building locally"
if [ "$TARGET" = "production" ]; then
  vercel build --prod
else
  vercel build
fi

step "Uploading prebuilt output"
if [ "$TARGET" = "production" ]; then
  vercel deploy --prebuilt --prod --yes
else
  vercel deploy --prebuilt --yes
fi
