#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--apply" || "$#" -ne 3 ]]; then
  echo "Usage: sudo -E bash $0 --apply <dr-public-key.pem> <export-dir>" >&2
  exit 2
fi

[[ "$EUID" -eq 0 ]] || {
  echo "Run as root with sudo -E." >&2
  exit 1
}

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PUBLIC_KEY="$2"
EXPORT_DIR="$3"
STATE_FILE="/var/lib/ecorione-staging/deploy-state.env"
RECEIPT_ROOT="${ECORIONE_DR_RECEIPT_ROOT:-/var/lib/ecorione-staging/dr-receipts}"
LOCK_FILE="/run/lock/ecorione-staging-dr-export.lock"

for command_name in flock docker node sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required." >&2
    exit 1
  }
done

[[ -f "$PUBLIC_KEY" && ! -L "$PUBLIC_KEY" ]] || {
  echo "DR public key must be a regular non-symlink file." >&2
  exit 1
}
[[ -f "$STATE_FILE" && ! -L "$STATE_FILE" ]] || {
  echo "Missing or unsafe staging release receipt." >&2
  exit 1
}
[[ "$(stat -c '%U:%G' "$STATE_FILE")" == "root:root" ]] || {
  echo "Staging release receipt must be root-owned." >&2
  exit 1
}

CURRENT_SHA="$(sed -n 's/^current_sha=//p' "$STATE_FILE")"
CURRENT_TAG="$(sed -n 's/^current_tag=//p' "$STATE_FILE")"
[[ "$CURRENT_SHA" =~ ^[0-9a-f]{40}$ ]] || {
  echo "Invalid current_sha in staging release receipt." >&2
  exit 1
}
[[ "$CURRENT_TAG" =~ ^staging-[0-9a-f]{12}$ ]] || {
  echo "Invalid current_tag in staging release receipt." >&2
  exit 1
}

REPO_OWNER="$(stat -c '%U' "$ROOT")"
git_as_owner() {
  sudo -u "$REPO_OWNER" git -C "$ROOT" "$@"
}

[[ "$(git_as_owner rev-parse HEAD)" == "$CURRENT_SHA" ]] || {
  echo "HEAD does not match the current staging release receipt." >&2
  exit 1
}
[[ -z "$(git_as_owner status --porcelain --untracked-files=no)" ]] || {
  echo "Tracked worktree is dirty." >&2
  exit 1
}

echo "Running read-only DR source readiness before any export mutation..."
SOURCE_READINESS_OUTPUT="$(
  ECORIONE_DR_PUBLIC_KEY="$PUBLIC_KEY" \
    sudo -E bash scripts/staging-offhost-dr-source-readiness.sh --check
)"
printf '%s\n' "$SOURCE_READINESS_OUTPUT"

SOURCE_TARGET_MIN="$(
  printf '%s\n' "$SOURCE_READINESS_OUTPUT" |
    sed -n 's/^target_min_free_kib=//p' |
    tail -n 1
)"
[[ "$SOURCE_TARGET_MIN" =~ ^[0-9]+$ ]] || {
  echo "Source readiness did not return a valid target_min_free_kib." >&2
  exit 1
}

REQUESTED_TARGET_MIN="${ECORIONE_DR_TARGET_MIN_FREE_KIB:-0}"
[[ "$REQUESTED_TARGET_MIN" =~ ^[0-9]+$ ]] || {
  echo "ECORIONE_DR_TARGET_MIN_FREE_KIB must be numeric when set." >&2
  exit 1
}
if (( REQUESTED_TARGET_MIN > SOURCE_TARGET_MIN )); then
  EFFECTIVE_TARGET_MIN="$REQUESTED_TARGET_MIN"
else
  EFFECTIVE_TARGET_MIN="$SOURCE_TARGET_MIN"
fi
export ECORIONE_DR_TARGET_MIN_FREE_KIB="$EFFECTIVE_TARGET_MIN"

echo "Running read-only independent-target readiness before any export mutation..."
sudo -E bash scripts/staging-offhost-dr-target-readiness.sh --check

install -d -o root -g root -m 0700 "$RECEIPT_ROOT"
if [[ -e "$EXPORT_DIR" ]]; then
  [[ -d "$EXPORT_DIR" && ! -L "$EXPORT_DIR" ]] || {
    echo "Export directory must be a regular directory." >&2
    exit 1
  }
  chmod 0700 "$EXPORT_DIR"
else
  install -d -o root -g root -m 0700 "$EXPORT_DIR"
fi

exec 9>"$LOCK_FILE"
flock -n 9 || {
  echo "Another ECORIONE DR export is already running." >&2
  exit 1
}

TMP_LOG="$(mktemp)"
CANARY_TMP="$RECEIPT_ROOT/canary-pre-$(date -u +%Y%m%dT%H%M%SZ)-${CURRENT_SHA:0:12}-$$.json"
cleanup() {
  rm -f "$TMP_LOG"
  rm -f "$CANARY_TMP"
}
trap cleanup EXIT

echo "Creating semantic owner-data canary before the cold backup..."
ECORIONE_COMPOSE_PROJECT="${ECORIONE_COMPOSE_PROJECT:-ecorione-staging}" \
  node scripts/staging-offhost-dr-canary.mjs --phase baseline --state "$CANARY_TMP"

echo "Creating a fresh coordinated current-revision cold backup..."
sudo -E bash scripts/staging-pcs09-backup.sh --apply | tee "$TMP_LOG"

BACKUP_DIR="$(sed -n 's/^backup_dir=//p' "$TMP_LOG" | tail -n 1)"
BACKUP_SHA="$(sed -n 's/^source_sha=//p' "$TMP_LOG" | tail -n 1)"
BACKUP_TAG="$(sed -n 's/^source_tag=//p' "$TMP_LOG" | tail -n 1)"

[[ -n "$BACKUP_DIR" && -d "$BACKUP_DIR" && ! -L "$BACKUP_DIR" ]] || {
  echo "Fresh backup did not return a safe backup_dir." >&2
  exit 1
}
[[ "$BACKUP_SHA" == "$CURRENT_SHA" ]] || {
  echo "Fresh backup SHA does not match the staging release receipt." >&2
  exit 1
}
[[ "$BACKUP_TAG" == "$CURRENT_TAG" ]] || {
  echo "Fresh backup tag does not match the staging release receipt." >&2
  exit 1
}

: >"$TMP_LOG"
node scripts/staging-offhost-dr-bundle.mjs \
  --backup-dir "$BACKUP_DIR" \
  --public-key "$PUBLIC_KEY" \
  --output-dir "$EXPORT_DIR" | tee "$TMP_LOG"

BUNDLE="$(sed -n 's/^bundle=//p' "$TMP_LOG" | tail -n 1)"
METADATA="$(sed -n 's/^metadata=//p' "$TMP_LOG" | tail -n 1)"
[[ -f "$BUNDLE" && ! -L "$BUNDLE" ]] || {
  echo "Bundler did not return a safe encrypted bundle." >&2
  exit 1
}
[[ -f "$METADATA" && ! -L "$METADATA" ]] || {
  echo "Bundler did not return safe metadata." >&2
  exit 1
}

META_SHA="$(
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(m.sourceSha || ""));
  ' "$METADATA"
)"
META_TAG="$(
  node -e '
    const fs = require("fs");
    const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.stdout.write(String(m.sourceTag || ""));
  ' "$METADATA"
)"
[[ "$META_SHA" == "$CURRENT_SHA" && "$META_TAG" == "$CURRENT_TAG" ]] || {
  echo "Encrypted bundle identity does not match the current staging release." >&2
  exit 1
}

BUNDLE_SHA256="$(sha256sum "$BUNDLE" | cut -d' ' -f1)"
METADATA_SHA256="$(sha256sum "$METADATA" | cut -d' ' -f1)"
STEM="$(basename "${BUNDLE%.ecdr}")"
EXPORT_MANIFEST="$EXPORT_DIR/$STEM.receipt.env"
CANARY_STATE="$EXPORT_DIR/$STEM.canary.json"
mv "$CANARY_TMP" "$CANARY_STATE"
chmod 0600 "$CANARY_STATE"
CANARY_SHA256="$(sha256sum "$CANARY_STATE" | cut -d' ' -f1)"

cat >"$EXPORT_MANIFEST" <<EOF
schema_version=1
created_at=$(date -u +%FT%TZ)
source_sha=$CURRENT_SHA
source_tag=$CURRENT_TAG
backup_run_id=$(basename "$BACKUP_DIR")
bundle_filename=$(basename "$BUNDLE")
metadata_filename=$(basename "$METADATA")
bundle_sha256=$BUNDLE_SHA256
metadata_sha256=$METADATA_SHA256
canary_filename=$(basename "$CANARY_STATE")
canary_sha256=$CANARY_SHA256
failure_domain_ack=1
transfer_intent=1
claim_boundary=portable encrypted DR generation manifest; off-host transfer and later retrieval must be independently verified
EOF
chmod 0600 "$EXPORT_MANIFEST"

echo "Transferring encrypted DR artifacts and export manifest to the acknowledged independent failure domain..."
sudo -E bash scripts/staging-offhost-dr-transfer.sh --apply \
  "$BUNDLE" "$METADATA" "$EXPORT_MANIFEST" "$CANARY_STATE"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RECEIPT="$RECEIPT_ROOT/export-$STAMP-${CURRENT_SHA:0:12}.env"
cat >"$RECEIPT" <<EOF
schema_version=1
created_at=$(date -u +%FT%TZ)
source_sha=$CURRENT_SHA
source_tag=$CURRENT_TAG
backup_run_id=$(basename "$BACKUP_DIR")
bundle_filename=$(basename "$BUNDLE")
metadata_filename=$(basename "$METADATA")
export_manifest_filename=$(basename "$EXPORT_MANIFEST")
bundle_sha256=$BUNDLE_SHA256
metadata_sha256=$METADATA_SHA256
canary_filename=$(basename "$CANARY_STATE")
canary_sha256=$CANARY_SHA256
failure_domain_ack=1
transfer_verified=1
claim_boundary=fresh current-revision cold backup encrypted and checksum-verified on acknowledged independent target; clean-host retrieval and recovery still required
EOF
chmod 0600 "$RECEIPT"

trap - EXIT
cleanup

echo "PASS ECORIONE current-revision off-host DR export"
echo "receipt=$RECEIPT"
echo "source_sha=$CURRENT_SHA"
echo "source_tag=$CURRENT_TAG"
echo "bundle_sha256=$BUNDLE_SHA256"
echo "metadata_sha256=$METADATA_SHA256"
echo "canary_sha256=$CANARY_SHA256"
echo "export_manifest=$(basename "$EXPORT_MANIFEST")"
echo "canary_state=$(basename "$CANARY_STATE")"
echo "IMPORTANT: transfer proof is not total-host-loss recovery; retrieve from the independent target and run clean-host recovery next."
