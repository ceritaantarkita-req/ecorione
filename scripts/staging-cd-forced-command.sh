#!/usr/bin/env bash
set -euo pipefail

ORIGINAL="${SSH_ORIGINAL_COMMAND:-}"
if [[ "$ORIGINAL" =~ ^deploy[[:space:]]([0-9a-f]{40})$ ]]; then
  exec sudo -n /usr/local/sbin/ecorione-staging-deploy "${BASH_REMATCH[1]}"
fi

echo "Denied: this key may only deploy one exact 40-character reviewed SHA." >&2
exit 126
