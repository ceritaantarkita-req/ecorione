#!/usr/bin/env bash
set -euo pipefail

[[ "${EUID}" -eq 0 ]] || { echo "Run with sudo/root." >&2; exit 1; }

DEPLOY_USER=ecorione-deploy
REPO=/srv/ecorione-staging
REPO_OWNER=ubuntu
PUBLIC_BASE_URL=
PUBLIC_KEY_FILE=
OPS_CREDENTIALS=/home/ubuntu/ecorione-staging-ops.txt
EDGE_NETWORK=inmydraft-demos_web
CERTRESOLVER=letsencrypt

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy-user) DEPLOY_USER="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --repo-owner) REPO_OWNER="$2"; shift 2 ;;
    --public-base-url) PUBLIC_BASE_URL="$2"; shift 2 ;;
    --public-key-file) PUBLIC_KEY_FILE="$2"; shift 2 ;;
    --ops-credentials) OPS_CREDENTIALS="$2"; shift 2 ;;
    --edge-network) EDGE_NETWORK="$2"; shift 2 ;;
    --certresolver) CERTRESOLVER="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo "Invalid deploy user" >&2; exit 2; }
[[ "$REPO_OWNER" =~ ^[a-z_][a-z0-9_-]*$ ]] || { echo "Invalid repo owner" >&2; exit 2; }
[[ "$PUBLIC_BASE_URL" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]] || {
  echo "--public-base-url must be an HTTPS origin" >&2
  exit 2
}
[[ -f "$PUBLIC_KEY_FILE" && ! -L "$PUBLIC_KEY_FILE" ]] || {
  echo "--public-key-file must point to a regular public-key file" >&2
  exit 2
}
[[ -d "$REPO/.git" ]] || { echo "Missing repo $REPO" >&2; exit 1; }
[[ -f "$OPS_CREDENTIALS" && ! -L "$OPS_CREDENTIALS" ]] || {
  echo "Missing operator credential file" >&2
  exit 1
}

PUBLIC_KEY="$(tr -d '\r\n' < "$PUBLIC_KEY_FILE")"
[[ "$PUBLIC_KEY" =~ ^ssh-ed25519[[:space:]][A-Za-z0-9+/=]+([[:space:]].*)?$ ]] || {
  echo "Deployment key must be one ssh-ed25519 public key" >&2
  exit 2
}

install -o root -g root -m 0755 scripts/staging-cd-forced-command.sh   /usr/local/sbin/ecorione-staging-deploy-gate
install -o root -g root -m 0755 scripts/staging-cd-root-deploy.sh   /usr/local/sbin/ecorione-staging-deploy

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$DEPLOY_USER"
fi
passwd -l "$DEPLOY_USER" >/dev/null 2>&1 || true

DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
[[ -n "$DEPLOY_HOME" ]] || { echo "Unable to determine deploy-user home" >&2; exit 1; }
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0700 "$DEPLOY_HOME/.ssh"
printf 'restrict,command="/usr/local/sbin/ecorione-staging-deploy-gate" %s\n' "$PUBLIC_KEY"   > "$DEPLOY_HOME/.ssh/authorized_keys"
chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_HOME/.ssh/authorized_keys"
chmod 0600 "$DEPLOY_HOME/.ssh/authorized_keys"

CONFIG_TMP="$(mktemp)"
{
  printf 'ECORIONE_STAGING_REPO=%q\n' "$REPO"
  printf 'ECORIONE_STAGING_REPO_OWNER=%q\n' "$REPO_OWNER"
  printf 'ECORIONE_STAGING_PUBLIC_BASE_URL=%q\n' "${PUBLIC_BASE_URL%/}"
  printf 'ECORIONE_STAGING_OPS_CREDENTIALS=%q\n' "$OPS_CREDENTIALS"
  printf 'ECORIONE_STAGING_EDGE_NETWORK=%q\n' "$EDGE_NETWORK"
  printf 'ECORIONE_STAGING_CERTRESOLVER=%q\n' "$CERTRESOLVER"
} > "$CONFIG_TMP"
install -o root -g root -m 0644 "$CONFIG_TMP" /etc/ecorione-staging-cd.conf
rm -f "$CONFIG_TMP"

SUDOERS_TMP="$(mktemp)"
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/ecorione-staging-deploy *\n' "$DEPLOY_USER"   > "$SUDOERS_TMP"
visudo -cf "$SUDOERS_TMP" >/dev/null
install -o root -g root -m 0440 "$SUDOERS_TMP" /etc/sudoers.d/ecorione-staging-deploy
rm -f "$SUDOERS_TMP"

echo "PASS staging CD host bootstrap"
echo "Deploy user: $DEPLOY_USER"
echo "Forced command: deploy <40-character-main-sha>"
echo "No Docker-group membership was added to the deploy user."
