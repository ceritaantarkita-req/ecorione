#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--apply" || ( "$#" -lt 3 || "$#" -gt 5 ) ]]; then
  echo "Usage: sudo -E bash $0 --apply <bundle.ecdr> <metadata.json> [export-manifest.receipt.env] [canary.json]" >&2
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
MANIFEST="${4:-}"
CANARY="${5:-}"
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

FILES=("$BUNDLE" "$META" "$IDENTITY" "$KNOWN_HOSTS")
if [[ -n "$MANIFEST" ]]; then
  FILES+=("$MANIFEST")
fi
if [[ -n "$CANARY" ]]; then
  [[ -n "$MANIFEST" ]] || {
    echo "Canary transfer requires the matching export manifest." >&2
    exit 1
  }
  FILES+=("$CANARY")
fi
for FILE in "${FILES[@]}"; do
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
STEM="${BUNDLE_NAME%.ecdr}"
[[ "$BUNDLE_NAME" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.ecdr$ ]] || {
  echo "Unexpected DR bundle filename." >&2
  exit 1
}
[[ "$META_NAME" =~ ^ecorione-dr-[A-Za-z0-9_.-]+\.json$ ]] || {
  echo "Unexpected DR metadata filename." >&2
  exit 1
}
[[ "$STEM" == "${META_NAME%.json}" ]] || {
  echo "Bundle and metadata stems do not match." >&2
  exit 1
}

MANIFEST_NAME=""
if [[ -n "$MANIFEST" ]]; then
  MANIFEST_NAME="$(basename "$MANIFEST")"
  [[ "$MANIFEST_NAME" == "$STEM.receipt.env" ]] || {
    echo "Export manifest must match the bundle stem and end with .receipt.env." >&2
    exit 1
  }
fi

CANARY_NAME=""
if [[ -n "$CANARY" ]]; then
  CANARY_NAME="$(basename "$CANARY")"
  [[ "$CANARY_NAME" == "$STEM.canary.json" ]] || {
    echo "Semantic canary state must match the bundle stem and end with .canary.json." >&2
    exit 1
  }
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

REMOTE_DIR_Q="$(remote_quote "$REMOTE_DIR")"
ssh "${SSH_OPTS[@]}" "$TARGET" "install -d -m 0700 $REMOTE_DIR_Q"

transfer_one() {
  local local_path="$1"
  local name="$2"
  local local_sha remote_sha final_sha part part_q final_q

  part="$REMOTE_DIR/.$name.part-$$"
  part_q="$(remote_quote "$part")"
  final_q="$(remote_quote "$REMOTE_DIR/$name")"

  scp "${SSH_OPTS[@]}" "$local_path" "$TARGET:$part"
  local_sha="$(sha256sum "$local_path" | cut -d' ' -f1)"
  remote_sha="$(
    ssh "${SSH_OPTS[@]}" "$TARGET" "sha256sum $part_q | cut -d' ' -f1"
  )"
  [[ "$local_sha" == "$remote_sha" ]] || {
    echo "Remote checksum mismatch for $name." >&2
    return 1
  }

  ssh "${SSH_OPTS[@]}" "$TARGET"     "chmod 0600 $part_q && mv -f $part_q $final_q"
  final_sha="$(
    ssh "${SSH_OPTS[@]}" "$TARGET" "sha256sum $final_q | cut -d' ' -f1"
  )"
  [[ "$local_sha" == "$final_sha" ]] || {
    echo "Final off-host checksum mismatch for $name." >&2
    return 1
  }
  printf '%s' "$local_sha"
}

LOCAL_BUNDLE_SHA="$(transfer_one "$BUNDLE" "$BUNDLE_NAME")"
LOCAL_META_SHA="$(transfer_one "$META" "$META_NAME")"
LOCAL_MANIFEST_SHA=""
if [[ -n "$MANIFEST" ]]; then
  LOCAL_MANIFEST_SHA="$(transfer_one "$MANIFEST" "$MANIFEST_NAME")"
fi
LOCAL_CANARY_SHA=""
if [[ -n "$CANARY" ]]; then
  LOCAL_CANARY_SHA="$(transfer_one "$CANARY" "$CANARY_NAME")"
fi

echo "PASS encrypted DR artifacts copied to independent SSH target with checksum verification"
echo "bundle_sha256=$LOCAL_BUNDLE_SHA"
echo "metadata_sha256=$LOCAL_META_SHA"
if [[ -n "$LOCAL_MANIFEST_SHA" ]]; then
  echo "export_manifest_sha256=$LOCAL_MANIFEST_SHA"
fi
if [[ -n "$LOCAL_CANARY_SHA" ]]; then
  echo "canary_sha256=$LOCAL_CANARY_SHA"
fi
echo "Private DR decryption key is intentionally not transferred by this script."
