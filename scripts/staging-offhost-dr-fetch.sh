#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--apply" || "$#" -ne 4 ]]; then
  echo "Usage: sudo -E bash $0 --apply <destination-dir> <export-manifest.receipt.env> <loss-marker.json>" >&2
  exit 2
fi

[[ "$EUID" -eq 0 ]] || {
  echo "Run as root with sudo -E." >&2
  exit 1
}

for command_name in node scp sha256sum stat; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required." >&2
    exit 1
  }
done

: "${ECORIONE_DR_SSH_TARGET:?set ECORIONE_DR_SSH_TARGET=user@independent-host}"
: "${ECORIONE_DR_SSH_DIR:?set ECORIONE_DR_SSH_DIR=/absolute/backup/path}"
: "${ECORIONE_DR_SSH_IDENTITY:?set ECORIONE_DR_SSH_IDENTITY=/root/.ssh/...}"
: "${ECORIONE_DR_SSH_KNOWN_HOSTS:?set ECORIONE_DR_SSH_KNOWN_HOSTS=/root/.ssh/...}"

[[ "${ECORIONE_DR_FAILURE_DOMAIN_ACK:-}" == "1" ]] || {
  echo "Set ECORIONE_DR_FAILURE_DOMAIN_ACK=1 only after confirming the target is outside the lost/source host failure domain." >&2
  exit 1
}

DEST_DIR="$2"
MANIFEST_NAME="$3"
LOSS_MARKER="$4"
TARGET="$ECORIONE_DR_SSH_TARGET"
REMOTE_DIR="${ECORIONE_DR_SSH_DIR%/}"
IDENTITY="$ECORIONE_DR_SSH_IDENTITY"
KNOWN_HOSTS="$ECORIONE_DR_SSH_KNOWN_HOSTS"

[[ "$MANIFEST_NAME" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.receipt\.env$ ]] || {
  echo "Unexpected export manifest filename." >&2
  exit 1
}
[[ "$TARGET" =~ ^[A-Za-z_][A-Za-z0-9_-]*@[A-Za-z0-9.-]+$ ]] || {
  echo "Invalid ECORIONE_DR_SSH_TARGET." >&2
  exit 1
}
[[ "$REMOTE_DIR" =~ ^/[A-Za-z0-9._/-]+$ && "$REMOTE_DIR" != *"//"* && "$REMOTE_DIR" != *"/../"* && "$REMOTE_DIR" != */.. ]] || {
  echo "Invalid ECORIONE_DR_SSH_DIR." >&2
  exit 1
}

for FILE in "$IDENTITY" "$KNOWN_HOSTS"; do
  [[ -f "$FILE" && ! -L "$FILE" ]] || {
    echo "Unsafe or missing file: $FILE" >&2
    exit 1
  }
done
[[ "$(stat -c '%a' "$IDENTITY")" == "600" ]] || {
  echo "DR SSH identity must be mode 600." >&2
  exit 1
}
KNOWN_MODE="$(stat -c '%a' "$KNOWN_HOSTS")"
[[ "$KNOWN_MODE" == "600" || "$KNOWN_MODE" == "644" ]] || {
  echo "DR known_hosts must be mode 600 or 644." >&2
  exit 1
}
[[ -s "$KNOWN_HOSTS" ]] || {
  echo "DR known_hosts is empty." >&2
  exit 1
}

[[ -f "$LOSS_MARKER" && ! -L "$LOSS_MARKER" ]] || {
  echo "Loss marker must be a regular non-symlink file created before retrieval." >&2
  exit 1
}
[[ "$(stat -c '%a' "$LOSS_MARKER")" == "600" ]] || {
  echo "Loss marker must be mode 600." >&2
  exit 1
}

LOSS_MARKER_INFO="$(
  node - "$LOSS_MARKER" "$MANIFEST_NAME" <<'NODE'
const { createHash } = require("node:crypto");
const { readFileSync } = require("node:fs");

const [path, manifestName] = process.argv.slice(2);
const raw = readFileSync(path);
let marker;
try {
  marker = JSON.parse(raw.toString("utf8"));
} catch {
  throw new Error("loss marker is not valid JSON");
}

if (
  marker?.schemaVersion !== 1 ||
  marker.kind !== "ecorione-offhost-dr-loss-marker" ||
  typeof marker.drillId !== "string" ||
  !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
    marker.drillId,
  ) ||
  typeof marker.declaredAt !== "string" ||
  !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u.test(marker.declaredAt) ||
  marker.expectedExportManifestFilename !== manifestName ||
  marker.clockSource !== "recovery-host-system-utc"
) {
  throw new Error("loss marker does not match the selected retained generation");
}

const declaredMs = Date.parse(marker.declaredAt);
if (!Number.isFinite(declaredMs) || declaredMs > Date.now()) {
  throw new Error("loss marker declaredAt is invalid or in the future");
}

const digest = createHash("sha256").update(raw).digest("hex");
process.stdout.write(
  [marker.drillId, marker.declaredAt, marker.clockSource, digest].join("\t"),
);
NODE
)" || {
  echo "Loss marker validation failed." >&2
  exit 1
}

IFS=$'\t' read -r LOSS_MARKER_DRILL_ID LOSS_DECLARED_AT LOSS_MARKER_CLOCK_SOURCE LOSS_MARKER_SHA <<<"$LOSS_MARKER_INFO"
[[ "$LOSS_MARKER_SHA" =~ ^[0-9a-f]{64}$ ]] || {
  echo "Loss marker SHA-256 validation failed." >&2
  exit 1
}
LOSS_MARKER_NAME="$(basename "$LOSS_MARKER")"
[[ "$LOSS_MARKER_NAME" =~ ^[A-Za-z0-9_.-]+\.json$ ]] || {
  echo "Loss marker filename is unsafe." >&2
  exit 1
}

if [[ -e "$DEST_DIR" ]]; then
  [[ -d "$DEST_DIR" && ! -L "$DEST_DIR" ]] || {
    echo "Destination must be a regular directory." >&2
    exit 1
  }
  chmod 0700 "$DEST_DIR"
else
  install -d -o root -g root -m 0700 "$DEST_DIR"
fi

SSH_OPTS=(
  -F /dev/null
  -i "$IDENTITY"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=yes
  -o "UserKnownHostsFile=$KNOWN_HOSTS"
  -o ConnectTimeout=15
  -o ClearAllForwardings=yes
)

remote_quote() {
  printf "'%s'" "${1//\'/\'\\\'\'}"
}

fetch_one() {
  local name="$1"
  local final="$DEST_DIR/$name"
  local part="$DEST_DIR/.$name.part-$$"
  local remote_q

  [[ ! -e "$final" && ! -e "$part" ]] || {
    echo "Refusing to overwrite local recovery artifact: $name" >&2
    return 1
  }

  remote_q="$(remote_quote "$REMOTE_DIR/$name")"
  if ! scp "${SSH_OPTS[@]}" "$TARGET:$remote_q" "$part"; then
    rm -f "$part"
    echo "Failed to fetch recovery artifact: $name" >&2
    return 1
  fi
  chmod 0600 "$part" || {
    rm -f "$part"
    echo "Failed to secure fetched recovery artifact: $name" >&2
    return 1
  }
  mv "$part" "$final" || {
    rm -f "$part"
    echo "Failed to finalize fetched recovery artifact: $name" >&2
    return 1
  }
  printf '%s' "$final"
}

RETRIEVAL_STARTED_AT="$(node -e 'process.stdout.write(new Date().toISOString())')"
node -e '
  const [declaredAt, startedAt] = process.argv.slice(1);
  if (Date.parse(declaredAt) > Date.parse(startedAt)) process.exit(1);
' "$LOSS_DECLARED_AT" "$RETRIEVAL_STARTED_AT" || {
  echo "Loss marker must predate retrieval start." >&2
  exit 1
}

MANIFEST_PATH="$(fetch_one "$MANIFEST_NAME")"

read_field() {
  local key="$1"
  sed -n "s/^$key=//p" "$MANIFEST_PATH" | tail -n 1
}

[[ "$(read_field schema_version)" == "1" ]] || {
  echo "Unsupported export manifest schema." >&2
  exit 1
}
[[ "$(read_field failure_domain_ack)" == "1" ]] || {
  echo "Export manifest does not record failure-domain acknowledgement." >&2
  exit 1
}
[[ "$(read_field transfer_intent)" == "1" ]] || {
  echo "Export manifest does not record transfer intent." >&2
  exit 1
}

BUNDLE_NAME="$(read_field bundle_filename)"
META_NAME="$(read_field metadata_filename)"
BUNDLE_SHA="$(read_field bundle_sha256)"
META_SHA="$(read_field metadata_sha256)"
CANARY_NAME="$(read_field canary_filename)"
CANARY_SHA="$(read_field canary_sha256)"

[[ "$BUNDLE_NAME" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.ecdr$ ]] || {
  echo "Invalid bundle filename in export manifest." >&2
  exit 1
}
[[ "$META_NAME" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.json$ ]] || {
  echo "Invalid metadata filename in export manifest." >&2
  exit 1
}
[[ "$CANARY_NAME" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.canary\.json$ ]] || {
  echo "Invalid canary filename in export manifest." >&2
  exit 1
}
[[ "$BUNDLE_SHA" =~ ^[0-9a-f]{64}$ && "$META_SHA" =~ ^[0-9a-f]{64}$ && "$CANARY_SHA" =~ ^[0-9a-f]{64}$ ]] || {
  echo "Invalid artifact hashes in export manifest." >&2
  exit 1
}
[[ "${BUNDLE_NAME%.ecdr}" == "${META_NAME%.json}" ]] || {
  echo "Export manifest artifact stems do not match." >&2
  exit 1
}
[[ "$MANIFEST_NAME" == "${BUNDLE_NAME%.ecdr}.receipt.env" ]] || {
  echo "Export manifest stem does not match bundle." >&2
  exit 1
}
[[ "$CANARY_NAME" == "${BUNDLE_NAME%.ecdr}.canary.json" ]] || {
  echo "Semantic canary stem does not match bundle." >&2
  exit 1
}

BUNDLE_PATH="$(fetch_one "$BUNDLE_NAME")"
META_PATH="$(fetch_one "$META_NAME")"
CANARY_PATH="$(fetch_one "$CANARY_NAME")"

ACTUAL_BUNDLE_SHA="$(sha256sum "$BUNDLE_PATH" | cut -d' ' -f1)"
ACTUAL_META_SHA="$(sha256sum "$META_PATH" | cut -d' ' -f1)"
ACTUAL_CANARY_SHA="$(sha256sum "$CANARY_PATH" | cut -d' ' -f1)"

[[ "$ACTUAL_BUNDLE_SHA" == "$BUNDLE_SHA" ]] || {
  echo "Retrieved bundle checksum mismatch." >&2
  exit 1
}
[[ "$ACTUAL_META_SHA" == "$META_SHA" ]] || {
  echo "Retrieved metadata checksum mismatch." >&2
  exit 1
}
[[ "$ACTUAL_CANARY_SHA" == "$CANARY_SHA" ]] || {
  echo "Retrieved semantic canary checksum mismatch." >&2
  exit 1
}

STEM="${BUNDLE_NAME%.ecdr}"
RETRIEVAL_RECEIPT="$DEST_DIR/$STEM.retrieval.env"
[[ ! -e "$RETRIEVAL_RECEIPT" ]] || {
  echo "Refusing to overwrite retrieval receipt." >&2
  exit 1
}

RETRIEVED_AT="$(node -e 'process.stdout.write(new Date().toISOString())')"

cat >"$RETRIEVAL_RECEIPT" <<EOF
schema_version=1
retrieval_started_at=$RETRIEVAL_STARTED_AT
retrieved_at=$RETRIEVED_AT
loss_marker_filename=$LOSS_MARKER_NAME
loss_marker_sha256=$LOSS_MARKER_SHA
loss_marker_drill_id=$LOSS_MARKER_DRILL_ID
loss_marker_clock_source=$LOSS_MARKER_CLOCK_SOURCE
loss_declared_at=$LOSS_DECLARED_AT
export_manifest_filename=$MANIFEST_NAME
bundle_filename=$BUNDLE_NAME
metadata_filename=$META_NAME
canary_filename=$CANARY_NAME
bundle_sha256=$BUNDLE_SHA
metadata_sha256=$META_SHA
canary_sha256=$CANARY_SHA
failure_domain_ack=1
retrieval_verified=1
claim_boundary=artifacts independently fetched after a marker-bound recovery clock was established and matched retained export-manifest hashes
EOF
chmod 0600 "$RETRIEVAL_RECEIPT"

echo "PASS ECORIONE DR artifacts retrieved from independent off-host target"
echo "bundle=$BUNDLE_PATH"
echo "metadata=$META_PATH"
echo "canary_state=$CANARY_PATH"
echo "retrieval_receipt=$RETRIEVAL_RECEIPT"
echo "loss_marker=$LOSS_MARKER"
echo "loss_marker_sha256=$LOSS_MARKER_SHA"
echo "loss_marker_drill_id=$LOSS_MARKER_DRILL_ID"
echo "retrieval_started_at=$RETRIEVAL_STARTED_AT"
echo "retrieved_at=$RETRIEVED_AT"
echo "bundle_sha256=$BUNDLE_SHA"
echo "metadata_sha256=$META_SHA"
echo "canary_sha256=$CANARY_SHA"
