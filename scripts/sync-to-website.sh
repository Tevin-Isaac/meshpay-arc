#!/usr/bin/env bash
# Build the web wallet for wayamesh.xyz/app and copy it into the Next.js website repo.
# Usage: scripts/sync-to-website.sh <website repo path>
#   VITE_RAMP_API_URL=https://ramp.example.com   optional: public URL of the ramp server (M-Pesa)
#   VITE_MESHPAY_ADDRESS=0x...                   optional override (defaults to .env / the testnet contract)
#
# Layout it produces in the site repo:
#   public/app-static/*   the built app (assets, index.html, icons, manifest)
#   public/sw.js          the service worker, at the site root so it can control /app
# The site must rewrite /app and /app/* to /app-static/index.html (it already does).
set -euo pipefail
SITE="${1:?usage: scripts/sync-to-website.sh <website repo path>}"
[ -d "$SITE/public" ] || { echo "no public/ in $SITE; is that the website repo?" >&2; exit 1; }
cd "$(dirname "$0")/.."

export VITE_BASE=/app-static/
export VITE_APP_PATH=/app
export VITE_MESHPAY_ADDRESS="${VITE_MESHPAY_ADDRESS:-0xd619b77bb8389a632800c300969ef152099f7691}"
[ -n "${VITE_RAMP_API_URL:-}" ] && export VITE_RAMP_API_URL

npx --yes vite build

rm -rf "$SITE/public/app-static"
mkdir -p "$SITE/public/app-static"
cp -R dist/. "$SITE/public/app-static/"
# The service worker must be served from the site root so its scope can be /app.
mv "$SITE/public/app-static/sw.js" "$SITE/public/sw.js"
# _headers is a Netlify/Cloudflare file and means nothing to Next.js, so it is not shipped.
# The headers it carries (CSP etc.) stay in this repo's dist/_headers: replicate them in the site's next.config.
rm -f "$SITE/public/app-static/_headers"

echo "Synced wallet into $SITE/public/app-static and $SITE/public/sw.js"
echo "Replicate the security headers from $(pwd)/dist/_headers in the site next.config (CSP connect-src must allow Arc RPC and the Nostr relays)."
