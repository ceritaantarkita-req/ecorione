#!/usr/bin/env bash
set -euo pipefail

apply=0
[[ "${1:-}" == "--apply" ]] && apply=1

fail() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "[origin-lockdown] $*"; }

command -v ufw >/dev/null 2>&1 || fail "ufw is required for this guarded cutover script"
command -v systemctl >/dev/null 2>&1 || fail "systemctl is required"
command -v node >/dev/null 2>&1 || fail "node is required for public smoke verification"

[[ -n "${ECORIONE_PUBLIC_BASE_URL:-}" ]] || fail "ECORIONE_PUBLIC_BASE_URL must point to the verified Cloudflare hostname"
ssh_port="${ECORIONE_SSH_PORT:-22}"

if ! sudo ufw status | grep -q '^Status: active'; then
  fail "ufw is not active; this script will not invent a firewall policy"
fi

if ! sudo ufw status | grep -E "(^|[[:space:]])${ssh_port}/tcp[[:space:]].*ALLOW" >/dev/null; then
  fail "no explicit UFW ALLOW rule detected for SSH TCP port ${ssh_port}; refusing web-port cutover"
fi

sudo systemctl is-active --quiet cloudflared || fail "cloudflared is not active"

info "verifying the public hostname before firewall mutation"
node scripts/production-public-smoke.mjs

if [[ "$apply" -ne 1 ]]; then
  info "dry run PASS: tunnel/public application is healthy and SSH allow rule exists"
  info "to close direct inbound 80/443, set ECORIONE_LOCKDOWN_ACK=I_UNDERSTAND_80_443_WILL_CLOSE and rerun with --apply"
  exit 0
fi

[[ "${ECORIONE_LOCKDOWN_ACK:-}" == "I_UNDERSTAND_80_443_WILL_CLOSE" ]] || fail "explicit ECORIONE_LOCKDOWN_ACK is required for --apply"

info "ensuring Cloudflare Tunnel egress remains permitted"
sudo ufw allow out 7844/tcp comment 'Cloudflare Tunnel HTTP2' >/dev/null || true
sudo ufw allow out 7844/udp comment 'Cloudflare Tunnel QUIC' >/dev/null || true

info "removing direct public web ingress rules"
sudo ufw delete allow 80/tcp >/dev/null 2>&1 || true
sudo ufw delete allow 443/tcp >/dev/null 2>&1 || true

if node scripts/production-public-smoke.mjs; then
  info "PASS: public application still works after direct 80/443 ingress removal"
else
  echo "ERROR: public smoke failed after lockdown; restoring 80/443 UFW allow rules" >&2
  sudo ufw allow 80/tcp >/dev/null || true
  sudo ufw allow 443/tcp >/dev/null || true
  exit 1
fi

sudo ufw status verbose
