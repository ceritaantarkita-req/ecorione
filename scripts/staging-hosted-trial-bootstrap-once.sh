#!/usr/bin/env bash
set -euo pipefail

PROJECT="${ECORIONE_COMPOSE_PROJECT:-}"
ENV_FILE="${1:-deploy/staging.env}"
MARKER_FILE="${ECORIONE_STAGING_HOSTED_TRIAL_MARKER:-data/release-receipts/staging-hosted-trial-v1.enabled}"

if [[ "$PROJECT" != "ecorione-staging" ]]; then
  echo "Hosted trial bootstrap skipped: project is not ecorione-staging."
  exit 0
fi

[[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || {
  echo "Hosted trial bootstrap refused: deployment env is missing or unsafe." >&2
  exit 1
}
[[ "$(stat -c '%a' "$ENV_FILE")" == "600" ]] || {
  echo "Hosted trial bootstrap refused: deployment env must be mode 600." >&2
  exit 1
}

if [[ -e "$MARKER_FILE" ]]; then
  [[ -f "$MARKER_FILE" && ! -L "$MARKER_FILE" ]] || {
    echo "Hosted trial bootstrap refused: marker is unsafe." >&2
    exit 1
  }
  echo "Hosted trial bootstrap already applied."
  exit 0
fi

python3 - "$ENV_FILE" <<'PY'
from decimal import Decimal, InvalidOperation
from pathlib import Path
import os
import sys

path = Path(sys.argv[1])
lines = path.read_text(encoding="utf-8").splitlines()
keys = {
    "ECORIONE_COST_KILL_SWITCH": "0",
    "ECORIONE_SPEND_DAILY_USD": "1",
    "ECORIONE_SPEND_MONTHLY_USD": "10",
    "ECORIONE_SPEND_UNLIMITED": "0",
}

values = {}
for line in lines:
    if "=" not in line or line.lstrip().startswith("#"):
        continue
    key, value = line.split("=", 1)
    if key in keys:
        values[key] = value.strip()

unlimited = values.get("ECORIONE_SPEND_UNLIMITED", "")
if unlimited not in ("", "0"):
    raise SystemExit("Hosted trial bootstrap refused: ECORIONE_SPEND_UNLIMITED must be 0.")

for key in ("ECORIONE_SPEND_DAILY_USD", "ECORIONE_SPEND_MONTHLY_USD"):
    value = values.get(key, "")
    if value:
        try:
            if Decimal(value) <= 0:
                raise ValueError
        except (InvalidOperation, ValueError):
            raise SystemExit(f"Hosted trial bootstrap refused: {key} must be a positive USD value.")

replacements = {
    "ECORIONE_COST_KILL_SWITCH": "0",
    "ECORIONE_SPEND_DAILY_USD": values.get("ECORIONE_SPEND_DAILY_USD") or "1",
    "ECORIONE_SPEND_MONTHLY_USD": values.get("ECORIONE_SPEND_MONTHLY_USD") or "10",
    "ECORIONE_SPEND_UNLIMITED": "0",
}

seen = set()
out = []
for line in lines:
    if "=" in line and not line.lstrip().startswith("#"):
        key = line.split("=", 1)[0]
        if key in replacements:
            out.append(f"{key}={replacements[key]}")
            seen.add(key)
            continue
    out.append(line)

for key, value in replacements.items():
    if key not in seen:
        out.append(f"{key}={value}")

tmp = path.with_name(path.name + ".hosted-trial.tmp")
tmp.write_text("\n".join(out) + "\n", encoding="utf-8")
os.chmod(tmp, 0o600)
os.replace(tmp, path)
PY

mkdir -p "$(dirname "$MARKER_FILE")"
umask 077
printf 'staging-hosted-trial-v1\n' > "$MARKER_FILE"
chmod 0600 "$MARKER_FILE"
echo "PASS staging hosted trial bootstrap: hosted enabled with bounded spend policy."
