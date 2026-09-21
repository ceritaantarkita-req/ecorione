#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--apply" || "$#" -ne 3 ]]; then
  echo "Usage: sudo -E bash $0 --apply <bundle.ecdr> <metadata.json>" >&2
  exit 2
fi

[[ "$EUID" -eq 0 ]] || {
  echo "Run as root with sudo -E." >&2
  exit 1
}

: "${ECORIONE_DR_SSH_TARGET:?set ECORIONE_DR_SSH_TARGET=user@independent-host}"
: "${ECORIONE_DR_SSH_DIR:?set ECORIONE_DR_SSH_DIR=/absolute/backup/path}"
: "${ECORIONE_DR_SSH_IDENTITY:?set ECORIONE_DR_SSH_IDENTITY=/root/.ssh/...}"
: "${ECORIONE_DR_SSH_KNOWN_HOSTS:?set ECORIONE_DR_SSH_KNOWN_HOSTS=/root/.ssh/...}"

[[ "${ECORIONE_DR_FAILURE_DOMAIN_ACK:-}" == "1" ]] || {
  echo "Set ECORIONE_DR_FAILURE_DOMAIN_ACK=1 only after confirming the target is outside the SumoPod failure domain." >&2
  exit 1
}

BUNDLE="$2"
META="$3"
TARGET="$ECORIONE_DR_SSH_TARGET"
REMOTE_DIR="${ECORIONE_DR_SSH_DIR%/}"
IDENTITY="$ECORIONE_DR_SSH_IDENTITY"
KNOWN_HOSTS="$ECORIONE_DR_SSH_KNOWN_HOSTS"

[[ "$TARGET" =~ ^[A-Za-z_][A-Za-z0-9_-]*@[A-Za-z0-9.-]+$ ]] || {
  echo "Invalid ECORIONE_DR_SSH_TARGET." >&2
  exit 1
}
[[ "$REMOTE_DIR" =~ ^/[A-Za-z0-9._/-]+$ && "$REMOTE_DIR" != *"//"* && "$REMOTE_DIR" != *"/../"* && "$REMOTE_DIR" != */.. ]] || {
  echo "Invalid ECORIONE_DR_SSH_DIR." >&2
  exit 1
}

for FILE in "$BUNDLE" "$META" "$IDENTITY" "$KNOWN_HOSTS"; do
  [[ -f "$FILE" && ! -L "$FILE" ]] || {
    echo "Unsafe or missing file: $FILE" >&2
    exit 1
  }
done

[[ "$(stat -c '%a' "$IDENTITY")" == "600" ]] || {
  echo "DR SSH identity must be mode 600." >&2
  exit 1
}

BUNDLE_NAME="$(basename "$BUNDLE")"
META_NAME="$(basename "$META")"
[[ "$BUNDLE_NAME" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.ecdr$ ]] || {
  echo "Unexpected DR bundle filename." >&2
  exit 1
}
[[ "$META_NAME" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.json$ ]] || {
  echo "Unexpected DR metadata filename." >&2
  exit 1
}
[[ "${BUNDLE_NAME%.ecdr}" == "${META_NAME%.json}" ]] || {
  echo "Bundle and metadata stems do not match." >&2
  exit 1
}

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

REMOTE_DIR_Q="$(remote_quote "$REMOTE_DIR")"
BUNDLE_PART="$REMOTE_DIR/.$BUNDLE_NAME.part-$$"
META_PART="$REMOTE_DIR/.$META_NAME.part-$$"
BUNDLE_PART_Q="$(remote_quote "$BUNDLE_PART")"
META_PART_Q="$(remote_quote "$META_PART")"
BUNDLE_FINAL_Q="$(remote_quote "$REMOTE_DIR/$BUNDLE_NAME")"
META_FINAL_Q="$(remote_quote "$REMOTE_DIR/$META_NAME")"

ssh "${SSH_OPTS[@]}" "$TARGET" "install -d -m 0700 $REMOTE_DIR_Q"
scp "${SSH_OPTS[@]}" "$BUNDLE" "$TARGET:$BUNDLE_PART"
scp "${SSH_OPTS[@]}" "$META" "$TARGET:$META_PART"

LOCAL_BUNDLE_SHA="$(sha256sum "$BUNDLE" | cut -d' ' -f1)"
LOCAL_META_SHA="$(sha256sum "$META" | cut -d' ' -f1)"
REMOTE_BUNDLE_SHA="$(
  ssh "${SSH_OPTS[@]}" "$TARGET"     "sha256sum $BUNDLE_PART_Q | cut -d' ' -f1"
)"
REMOTE_META_SHA="$(
  ssh "${SSH_OPTS[@]}" "$TARGET"     "sha256sum $META_PART_Q | cut -d' ' -f1"
)"

[[ "$LOCAL_BUNDLE_SHA" == "$REMOTE_BUNDLE_SHA" ]] || {
  echo "Remote bundle checksum mismatch." >&2
  exit 1
}
[[ "$LOCAL_META_SHA" == "$REMOTE_META_SHA" ]] || {
  echo "Remote metadata checksum mismatch." >&2
  exit 1
}

ssh "${SSH_OPTS[@]}" "$TARGET"   "chmod 0600 $BUNDLE_PART_Q $META_PART_Q && mv -f $BUNDLE_PART_Q $BUNDLE_FINAL_Q && mv -f $META_PART_Q $META_FINAL_Q"

FINAL_BUNDLE_SHA="$(
  ssh "${SSH_OPTS[@]}" "$TARGET"     "sha256sum $BUNDLE_FINAL_Q | cut -d' ' -f1"
)"
FINAL_META_SHA="$(
  ssh "${SSH_OPTS[@]}" "$TARGET"     "sha256sum $META_FINAL_Q | cut -d' ' -f1"
)"

[[ "$LOCAL_BUNDLE_SHA" == "$FINAL_BUNDLE_SHA" && "$LOCAL_META_SHA" == "$FINAL_META_SHA" ]] || {
  echo "Final off-host checksum verification failed." >&2
  exit 1
}

echo "PASS encrypted DR bundle copied to independent SSH target with checksum verification"
echo "bundle_sha256=$LOCAL_BUNDLE_SHA"
echo "metadata_sha256=$LOCAL_META_SHA"
echo "Private DR decryption key is intentionally not transferred by this script."
