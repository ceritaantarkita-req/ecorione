#!/usr/bin/env bash
set -euo pipefail

apply=0
[[ "${1:-}" == "--apply" ]] && apply=1

fail() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "[cloudflare] $*"; }

command -v cloudflared >/dev/null 2>&1 || fail "cloudflared is required; install the official package first"
command -v systemctl >/dev/null 2>&1 || fail "systemd/systemctl is required for this installer"

cloudflared --version

# Cloudflare Tunnel requires outbound connectivity to its edge on port 7844.
edge_ok=0
for host in region1.v2.argotunnel.com region2.v2.argotunnel.com; do
  if timeout 8 bash -c "</dev/tcp/${host}/7844" 2>/dev/null; then
    info "outbound TCP 7844 reachable: ${host}"
    edge_ok=1
    break
  fi
done
[[ "$edge_ok" -eq 1 ]] || fail "cannot reach Cloudflare Tunnel edge on TCP 7844"

if [[ "$apply" -ne 1 ]]; then
  info "dry run PASS"
  info "to install a remotely-managed named tunnel service: export CLOUDFLARE_TUNNEL_TOKEN in the current shell and rerun with --apply"
  exit 0
fi

[[ -n "${CLOUDFLARE_TUNNEL_TOKEN:-}" ]] || fail "CLOUDFLARE_TUNNEL_TOKEN is required for --apply; do not store it in git"

if systemctl list-unit-files cloudflared.service >/dev/null 2>&1 && systemctl cat cloudflared.service >/dev/null 2>&1; then
  fail "cloudflared.service already exists; inspect/upgrade it explicitly instead of overwriting production service state"
fi

info "installing remotely-managed cloudflared system service; token value will not be printed by this script"
sudo cloudflared service install "$CLOUDFLARE_TUNNEL_TOKEN"
sudo systemctl enable cloudflared >/dev/null 2>&1 || true
sudo systemctl restart cloudflared
sleep 2
sudo systemctl is-active --quiet cloudflared || fail "cloudflared service is not active after installation"

info "PASS: cloudflared service is active"
info "next: in Cloudflare Networking > Tunnels, map the production hostname to https://localhost:443 and set Origin Server Name to the ECORIONE hostname when required by the Caddy certificate"
