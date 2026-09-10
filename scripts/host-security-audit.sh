#!/usr/bin/env bash
set -euo pipefail

strict=0
[[ "${1:-}" == "--strict" ]] && strict=1
warnings=0

warn() { echo "WARN: $*"; warnings=$((warnings + 1)); }
info() { echo "[host-audit] $*"; }

info "kernel: $(uname -srmo)"
if [[ -r /etc/os-release ]]; then
  . /etc/os-release
  info "os: ${PRETTY_NAME:-unknown}"
fi

if command -v ufw >/dev/null 2>&1; then
  sudo ufw status verbose || warn "unable to read UFW status"
  sudo ufw status | grep -q '^Status: active' || warn "UFW is not active"
else
  warn "ufw is not installed; verify equivalent host firewall manually"
fi

if command -v ss >/dev/null 2>&1; then
  echo "--- listening sockets ---"
  sudo ss -lntup || ss -lntup || true
fi

if command -v sshd >/dev/null 2>&1; then
  sshd_effective="$(sudo sshd -T 2>/dev/null || sshd -T 2>/dev/null || true)"
  if [[ -n "$sshd_effective" ]]; then
    root_login="$(printf '%s\n' "$sshd_effective" | awk '$1=="permitrootlogin" {print $2; exit}')"
    password_auth="$(printf '%s\n' "$sshd_effective" | awk '$1=="passwordauthentication" {print $2; exit}')"
    info "sshd permitrootlogin=${root_login:-unknown} passwordauthentication=${password_auth:-unknown}"
    [[ "$root_login" == "no" || "$root_login" == "prohibit-password" || "$root_login" == "without-password" ]] || warn "SSH root login is not clearly restricted"
    [[ "$password_auth" == "no" ]] || warn "SSH password authentication is enabled or unresolved; key-only is recommended for production"
  else
    warn "unable to resolve effective sshd configuration"
  fi
else
  warn "sshd command is unavailable; verify SSH policy manually"
fi

if systemctl list-unit-files unattended-upgrades.service >/dev/null 2>&1; then
  systemctl is-enabled --quiet unattended-upgrades.service || warn "unattended-upgrades is not enabled"
else
  warn "unattended-upgrades service is not installed"
fi

if command -v docker >/dev/null 2>&1; then
  docker version --format 'docker server={{.Server.Version}}' 2>/dev/null || warn "Docker daemon is unavailable to current user"
  if getent group docker >/dev/null 2>&1; then
    members="$(getent group docker | cut -d: -f4)"
    [[ -z "$members" ]] || warn "docker group grants root-equivalent daemon access to: $members"
  fi
else
  warn "docker is not installed"
fi

ENV_FILE="${ECORIONE_PRODUCTION_ENV:-deploy/production.env}"
if [[ -e "$ENV_FILE" ]]; then
  [[ ! -L "$ENV_FILE" ]] || warn "$ENV_FILE is a symlink"
  mode="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || true)"
  [[ -z "$mode" || "$mode" == "600" ]] || warn "$ENV_FILE mode is $mode; expected 600"
  grep -q 'CHANGE_ME' "$ENV_FILE" && warn "$ENV_FILE still contains CHANGE_ME placeholders"
else
  warn "$ENV_FILE does not exist on this host"
fi

if systemctl list-unit-files cloudflared.service >/dev/null 2>&1; then
  systemctl is-active --quiet cloudflared.service || warn "cloudflared service exists but is not active"
else
  warn "cloudflared system service is not installed"
fi

if command -v timedatectl >/dev/null 2>&1; then
  timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -qi '^yes$' || warn "system clock is not reported NTP-synchronized"
fi

if [[ "$warnings" -eq 0 ]]; then
  info "PASS: no warnings detected by the baseline host audit"
  exit 0
fi

warn "$warnings audit warning(s) require operator review"
[[ "$strict" -eq 0 ]] || exit 2
