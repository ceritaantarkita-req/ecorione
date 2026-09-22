#!/usr/bin/env bash
set -Eeuo pipefail

MODE="${1:-}"
if [[ "$MODE" != "--report" && "$MODE" != "--check" ]] || [[ "$#" -ne 1 ]]; then
  echo "Usage: sudo -E bash $0 --report|--check" >&2
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
MIN_GENERATIONS="${ECORIONE_DR_RETENTION_MIN_GENERATIONS:-3}"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

for command_name in ssh stat; do
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required"
done

[[ "$TARGET" =~ ^[A-Za-z_][A-Za-z0-9_-]*@[A-Za-z0-9.-]+$ ]] ||   fail "invalid ECORIONE_DR_SSH_TARGET"
[[ "$REMOTE_DIR" =~ ^/[A-Za-z0-9._/-]+$ && "$REMOTE_DIR" != *"//"* && "$REMOTE_DIR" != *"/../"* && "$REMOTE_DIR" != */.. ]] ||   fail "invalid ECORIONE_DR_SSH_DIR"
[[ "$MIN_GENERATIONS" =~ ^[0-9]+$ && "$MIN_GENERATIONS" -ge 1 ]] ||   fail "ECORIONE_DR_RETENTION_MIN_GENERATIONS must be an integer >= 1"

for FILE in "$IDENTITY" "$KNOWN_HOSTS"; do
  [[ -f "$FILE" && ! -L "$FILE" ]] || fail "unsafe or missing file: $FILE"
done
[[ "$(stat -c '%a' "$IDENTITY")" == "600" ]] || fail "DR SSH identity must be mode 600"
KNOWN_MODE="$(stat -c '%a' "$KNOWN_HOSTS")"
[[ "$KNOWN_MODE" == "600" || "$KNOWN_MODE" == "644" ]] ||   fail "DR known_hosts must be mode 600 or 644"
[[ -s "$KNOWN_HOSTS" ]] || fail "DR known_hosts is empty"

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
ssh "${SSH_OPTS[@]}" "$TARGET"   "set -eu; test -d $REMOTE_DIR_Q; test ! -L $REMOTE_DIR_Q; test -r $REMOTE_DIR_Q"

MANIFESTS="$(
  ssh "${SSH_OPTS[@]}" "$TARGET"     "set -eu; find $REMOTE_DIR_Q -maxdepth 1 -type f -name 'ecorione-dr-*.receipt.env' -printf '%f\n' | sort"
)"

COMPLETE=0
INCOMPLETE=0
LATEST_CREATED=""
LATEST_MANIFEST=""
LATEST_SOURCE_SHA=""
LATEST_SOURCE_TAG=""

read_field() {
  local body="$1"
  local key="$2"
  printf '%s\n' "$body" | sed -n "s/^$key=//p" | tail -n 1
}

audit_generation() {
  local manifest_name="$1"
  local manifest_path="$REMOTE_DIR/$manifest_name"
  local manifest_q manifest_mode body stem created source_sha source_tag
  local bundle_name metadata_name canary_name bundle_sha metadata_sha canary_sha
  local file_name expected actual file_q mode

  [[ "$manifest_name" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.receipt\.env$ ]] || return 1
  manifest_q="$(remote_quote "$manifest_path")"

  manifest_mode="$(
    ssh "${SSH_OPTS[@]}" "$TARGET" \
      "set -eu; test -f $manifest_q; test ! -L $manifest_q; stat -c '%a' $manifest_q"
  )" || return 1
  [[ "$manifest_mode" == "600" ]] || return 1

  body="$(
    ssh "${SSH_OPTS[@]}" "$TARGET" \
      "set -eu; cat $manifest_q"
  )" || return 1

  [[ "$(read_field "$body" schema_version)" == "1" ]] || return 1
  [[ "$(read_field "$body" failure_domain_ack)" == "1" ]] || return 1
  [[ "$(read_field "$body" transfer_intent)" == "1" ]] || return 1

  created="$(read_field "$body" created_at)"
  source_sha="$(read_field "$body" source_sha)"
  source_tag="$(read_field "$body" source_tag)"
  bundle_name="$(read_field "$body" bundle_filename)"
  metadata_name="$(read_field "$body" metadata_filename)"
  canary_name="$(read_field "$body" canary_filename)"
  bundle_sha="$(read_field "$body" bundle_sha256)"
  metadata_sha="$(read_field "$body" metadata_sha256)"
  canary_sha="$(read_field "$body" canary_sha256)"

  [[ "$created" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$ ]] || return 1
  [[ "$source_sha" =~ ^[0-9a-f]{40}$ ]] || return 1
  [[ "$source_tag" == "staging-${source_sha:0:12}" ]] || return 1
  [[ "$bundle_name" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.ecdr$ ]] || return 1
  [[ "$metadata_name" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.json$ ]] || return 1
  [[ "$canary_name" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.canary\.json$ ]] || return 1
  [[ "$bundle_sha" =~ ^[0-9a-f]{64}$ ]] || return 1
  [[ "$metadata_sha" =~ ^[0-9a-f]{64}$ ]] || return 1
  [[ "$canary_sha" =~ ^[0-9a-f]{64}$ ]] || return 1

  stem="${bundle_name%.ecdr}"
  [[ "$metadata_name" == "$stem.json" ]] || return 1
  [[ "$canary_name" == "$stem.canary.json" ]] || return 1
  [[ "$manifest_name" == "$stem.receipt.env" ]] || return 1

  for pair in     "$bundle_name:$bundle_sha"     "$metadata_name:$metadata_sha"     "$canary_name:$canary_sha"; do
    file_name="${pair%%:*}"
    expected="${pair#*:}"
    file_q="$(remote_quote "$REMOTE_DIR/$file_name")"
    mode="$(
      ssh "${SSH_OPTS[@]}" "$TARGET"         "set -eu; test -f $file_q; test ! -L $file_q; stat -c '%a' $file_q"
    )" || return 1
    [[ "$mode" == "600" ]] || return 1
    actual="$(
      ssh "${SSH_OPTS[@]}" "$TARGET"         "set -eu; sha256sum $file_q | cut -d' ' -f1"
    )" || return 1
    [[ "$actual" == "$expected" ]] || return 1
  done

  if [[ -z "$LATEST_CREATED" || "$created" > "$LATEST_CREATED" ]]; then
    LATEST_CREATED="$created"
    LATEST_MANIFEST="$manifest_name"
    LATEST_SOURCE_SHA="$source_sha"
    LATEST_SOURCE_TAG="$source_tag"
  fi
  return 0
}

while IFS= read -r MANIFEST; do
  [[ -n "$MANIFEST" ]] || continue
  if audit_generation "$MANIFEST"; then
    (( COMPLETE += 1 ))
    echo "generation=$MANIFEST status=complete"
  else
    (( INCOMPLETE += 1 ))
    echo "generation=$MANIFEST status=incomplete"
  fi
done <<<"$MANIFESTS"

RETENTION_READY=0
if (( COMPLETE >= MIN_GENERATIONS )); then
  RETENTION_READY=1
fi

echo "PASS ECORIONE off-host generation audit"
echo "complete_generations=$COMPLETE"
echo "incomplete_generations=$INCOMPLETE"
echo "retention_min_generations=$MIN_GENERATIONS"
echo "retention_ready=$RETENTION_READY"
echo "latest_created_at=$LATEST_CREATED"
echo "latest_manifest=$LATEST_MANIFEST"
echo "latest_source_sha=$LATEST_SOURCE_SHA"
echo "latest_source_tag=$LATEST_SOURCE_TAG"
echo "IMPORTANT: audit is read-only; no remote generation was created, renamed, or deleted."

if [[ "$MODE" == "--check" ]]; then
  (( INCOMPLETE == 0 )) || fail "one or more retained DR generations are incomplete or corrupt"
  (( COMPLETE >= MIN_GENERATIONS )) ||     fail "retention policy requires at least $MIN_GENERATIONS complete generations"
fi
