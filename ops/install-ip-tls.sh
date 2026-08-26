#!/usr/bin/env bash
set -Eeuo pipefail

readonly PUBLIC_IP="${1:-187.77.255.164}"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly NGINX_TARGET='/etc/nginx/sites-available/aninexus'
readonly ACME_ROOT='/var/www/aninexus-acme'
readonly BACKUP_ROOT='/var/backups/aninexus'
readonly BACKUP_FILE="${BACKUP_ROOT}/nginx-$(date -u +%Y%m%dT%H%M%SZ).conf"

[[ "$PUBLIC_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || { echo 'IP público inválido.' >&2; exit 2; }
[[ -f "${SCRIPT_DIR}/nginx/aninexus-bootstrap.conf" && -f "${SCRIPT_DIR}/nginx/aninexus.conf" && -f "${SCRIPT_DIR}/letsencrypt/reload-aninexus-nginx" ]] || { echo 'Arquivos de TLS/Nginx ausentes.' >&2; exit 2; }

install -d -m 0755 "$ACME_ROOT/.well-known/acme-challenge" "$BACKUP_ROOT"
install -m 0644 "$NGINX_TARGET" "$BACKUP_FILE"

rollback(){
  install -m 0644 "$BACKUP_FILE" "$NGINX_TARGET"
  nginx -t && systemctl reload nginx || true
}
trap rollback ERR

install -m 0644 "${SCRIPT_DIR}/nginx/aninexus-bootstrap.conf" "$NGINX_TARGET"
nginx -t
systemctl reload nginx

if ! command -v certbot >/dev/null 2>&1 || ! certbot --version 2>&1 | grep -Eq 'certbot (5\.[4-9]|[6-9]\.|[1-9][0-9]+\.)'; then
  snap install certbot --classic
fi

certbot certonly --staging --non-interactive --agree-tos --register-unsafely-without-email \
  --preferred-profile shortlived --webroot --webroot-path "$ACME_ROOT" \
  --ip-address "$PUBLIC_IP" --cert-name aninexus-ip-staging

certbot certonly --non-interactive --agree-tos --register-unsafely-without-email \
  --preferred-profile shortlived --webroot --webroot-path "$ACME_ROOT" \
  --ip-address "$PUBLIC_IP" --cert-name "$PUBLIC_IP"

install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
install -m 0755 "${SCRIPT_DIR}/letsencrypt/reload-aninexus-nginx" /etc/letsencrypt/renewal-hooks/deploy/reload-aninexus-nginx

install -m 0644 "${SCRIPT_DIR}/nginx/aninexus.conf" "$NGINX_TARGET"
nginx -t
systemctl reload nginx
certbot delete --cert-name aninexus-ip-staging --non-interactive || true
systemctl enable --now snap.certbot.renew.timer 2>/dev/null || true

curl --fail --silent --show-error --max-time 15 "https://${PUBLIC_IP}/release.json" >/dev/null
homepage="$(curl --fail --silent --show-error --max-time 15 "https://${PUBLIC_IP}/")"
grep -Fq '<meta name="aninexus-build"' <<<"$homepage"
trap - ERR
echo "HTTPS ativo e validado em https://${PUBLIC_IP}/"
