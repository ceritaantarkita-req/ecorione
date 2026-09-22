#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--check" || "$#" -ne 1 ]]; then
  echo "Usage: sudo -E bash $0 --check" >&2
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

TARGET="$ECORIONE_DR_SSH_TARGET"
REMOTE_DIR="${ECORIONE_DR_SSH_DIR%/}"
IDENTITY="$ECORIONE_DR_SSH_IDENTITY"
KNOWN_HOSTS="$ECORIONE_DR_SSH_KNOWN_HOSTS"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

for command_name in ssh stat; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done

[[ "$TARGET" =~ ^[A-Za-z_][A-Za-z0-9_-]*@[A-Za-z0-9.-]+$ ]] ||   fail "invalid ECORIONE_DR_SSH_TARGET"
[[ "$REMOTE_DIR" =~ ^/[A-Za-z0-9._/-]+$ && "$REMOTE_DIR" != *"//"* && "$REMOTE_DIR" != *"/../"* && "$REMOTE_DIR" != */.. ]] ||   fail "invalid ECORIONE_DR_SSH_DIR"

for FILE in "$IDENTITY" "$KNOWN_HOSTS"; do
  [[ -f "$FILE" && ! -L "$FILE" ]] || fail "unsafe or missing file: $FILE"
done
[[ "$(stat -c '%a' "$IDENTITY")" == "600" ]] || fail "DR SSH identity must be mode 600"
KNOWN_MODE="$(stat -c '%a' "$KNOWN_HOSTS")"
[[ "$KNOWN_MODE" == "600" || "$KNOWN_MODE" == "644" ]] ||   fail "DR known_hosts must be mode 600 or 644"
[[ -s "$KNOWN_HOSTS" ]] || fail "DR known_hosts is empty"

: "${ECORIONE_DR_TARGET_MIN_FREE_KIB:?set ECORIONE_DR_TARGET_MIN_FREE_KIB from source readiness backup_required_kib}"
MIN_TARGET_KIB="$ECORIONE_DR_TARGET_MIN_FREE_KIB"
[[ "$MIN_TARGET_KIB" =~ ^[0-9]+$ ]] || fail "ECORIONE_DR_TARGET_MIN_FREE_KIB must be numeric"

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
RESULT="$(
  ssh "${SSH_OPTS[@]}" "$TARGET"     "set -eu; test -d $REMOTE_DIR_Q; test ! -L $REMOTE_DIR_Q; test -w $REMOTE_DIR_Q; stat -c 'owner=%U mode=%a' $REMOTE_DIR_Q; printf 'available_kib='; df -Pk $REMOTE_DIR_Q | tail -n 1 | tr -s ' ' | cut -d' ' -f4"
)"

OWNER="$(printf '%s\n' "$RESULT" | sed -n 's/^owner=\([^ ]*\) mode=.*/\1/p')"
MODE="$(printf '%s\n' "$RESULT" | sed -n 's/^owner=[^ ]* mode=\([0-9]*\)$/\1/p')"
AVAILABLE_KIB="$(printf '%s\n' "$RESULT" | sed -n 's/^available_kib=//p')"

[[ -n "$OWNER" ]] || fail "unable to verify remote backup directory owner"
[[ "$MODE" == "700" || "$MODE" == "750" ]] ||   fail "remote backup directory mode must be 700 or 750"
[[ "$AVAILABLE_KIB" =~ ^[0-9]+$ ]] || fail "unable to verify remote free space"

(( AVAILABLE_KIB >= MIN_TARGET_KIB )) || {
  echo "available_kib=$AVAILABLE_KIB required_min_kib=$MIN_TARGET_KIB" >&2
  fail "independent target free space is below the configured minimum"
}

echo "PASS ECORIONE independent off-host target readiness"
echo "target=$TARGET"
echo "remote_dir=$REMOTE_DIR"
echo "remote_owner=$OWNER"
echo "remote_mode=$MODE"
echo "remote_available_kib=$AVAILABLE_KIB"
echo "failure_domain_ack=1"
echo "IMPORTANT: this check performs no upload, mkdir, rename, or deletion on the remote target."
