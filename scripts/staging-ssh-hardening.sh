#!/usr/bin/env bash
set -Eeuo pipefail

mode="${1:---check}"
dropin="/etc/ssh/sshd_config.d/00-ecorione-staging-hardening.conf"

case "$mode" in
  --check|--apply) ;;
  *)
    echo "Usage: $0 [--check|--apply]" >&2
    exit 2
    ;;
esac

print_effective() {
  sshd -T | awk '
    $1=="permitrootlogin" ||
    $1=="passwordauthentication" ||
    $1=="kbdinteractiveauthentication" ||
    $1=="pubkeyauthentication" ||
    $1=="permitemptypasswords" {print}
  '
}

if [[ "$mode" == "--check" ]]; then
  if [[ "$EUID" -eq 0 ]]; then
    print_effective
  else
    sudo -n sshd -T | awk '
      $1=="permitrootlogin" ||
      $1=="passwordauthentication" ||
      $1=="kbdinteractiveauthentication" ||
      $1=="pubkeyauthentication" ||
      $1=="permitemptypasswords" {print}
    '
  fi
  echo "CHECK ONLY: no SSH configuration changed."
  exit 0
fi

[[ "$EUID" -eq 0 ]] || {
  echo "Apply mode must run as root: sudo bash $0 --apply" >&2
  exit 1
}

command -v sshd >/dev/null
mkdir -p /etc/ssh/sshd_config.d

backup=""
if [[ -e "$dropin" ]]; then
  backup="$(mktemp)"
  cp -a "$dropin" "$backup"
fi

rollback() {
  if [[ -n "$backup" && -e "$backup" ]]; then
    cp -a "$backup" "$dropin"
  else
    rm -f "$dropin"
  fi
}

trap 'rollback' ERR

tmp="$(mktemp)"
cat >"$tmp" <<'EOF'
# ECORIONE PCS-09 staging SSH baseline.
# 00- prefix is intentional because OpenSSH uses the first obtained value.
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PermitRootLogin no
EOF

install -o root -g root -m 0644 "$tmp" "$dropin"
rm -f "$tmp"

sshd -t
resolved="$(sshd -T)"

grep -q '^pubkeyauthentication yes$' <<<"$resolved"
grep -q '^passwordauthentication no$' <<<"$resolved"
grep -q '^kbdinteractiveauthentication no$' <<<"$resolved"
grep -q '^permitemptypasswords no$' <<<"$resolved"
grep -q '^permitrootlogin no$' <<<"$resolved"

if systemctl reload ssh; then
  :
elif systemctl reload sshd; then
  :
else
  echo "Unable to reload SSH; restoring prior drop-in." >&2
  rollback
  sshd -t
  exit 1
fi

trap - ERR
[[ -z "$backup" ]] || rm -f "$backup"

echo "PASS PCS-09 SSH hardening applied."
echo "IMPORTANT: keep this session open and prove a NEW operator public-key SSH session before closing it."
