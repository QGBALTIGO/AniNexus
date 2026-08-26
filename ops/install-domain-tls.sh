#!/usr/bin/env bash
set -Eeuo pipefail

readonly DOMAIN="${1:-aninexus.com.br}"
readonly WWW_DOMAIN="www.${DOMAIN}"
readonly EMAIL="${LETSENCRYPT_EMAIL:-}"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly NGINX_TARGET='/etc/nginx/sites-available/aninexus'
readonly ACME_ROOT='/var/www/aninexus-acme'
readonly BACKUP_ROOT='/var/backups/aninexus'
readonly BACKUP_FILE="${BACKUP_ROOT}/nginx-domain-$(date -u +%Y%m%dT%H%M%SZ).conf"

[[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo 'Domínio inválido.' >&2; exit 2; }
[[ -f "${SCRIPT_DIR}/nginx/aninexus-bootstrap.conf" && -f "${SCRIPT_DIR}/nginx/aninexus.conf" && -f "${SCRIPT_DIR}/letsencrypt/reload-aninexus-nginx" ]] || { echo 'Arquivos de TLS/Nginx ausentes.' >&2; exit 2; }

install -d -m 0755 "$ACME_ROOT/.well-known/acme-challenge" "$BACKUP_ROOT"
if [[ -f "$NGINX_TARGET" ]]; then install -m 0644 "$NGINX_TARGET" "$BACKUP_FILE"; fi

rollback(){
  if [[ -f "$BACKUP_FILE" ]]; then
    install -m 0644 "$BACKUP_FILE" "$NGINX_TARGET"
    nginx -t && systemctl reload nginx || true
  fi
}
trap rollback ERR

install -m 0644 "${SCRIPT_DIR}/nginx/aninexus-bootstrap.conf" "$NGINX_TARGET"
nginx -t
systemctl reload nginx

if ! command -v certbot >/dev/null 2>&1; then
  if command -v snap >/dev/null 2>&1; then
    snap install certbot --classic
  else
    apt-get update
    apt-get install -y certbot
  fi
fi

cert_args=(certonly --non-interactive --agree-tos --webroot --webroot-path "$ACME_ROOT" --cert-name "$DOMAIN" -d "$DOMAIN" -d "$WWW_DOMAIN")
if [[ -n "$EMAIL" ]]; then
  cert_args+=(--email "$EMAIL")
else
  cert_args+=(--register-unsafely-without-email)
fi
certbot "${cert_args[@]}"

install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
install -m 0755 "${SCRIPT_DIR}/letsencrypt/reload-aninexus-nginx" /etc/letsencrypt/renewal-hooks/deploy/reload-aninexus-nginx
install -m 0644 "${SCRIPT_DIR}/nginx/aninexus.conf" "$NGINX_TARGET"
nginx -t
systemctl reload nginx
systemctl enable --now snap.certbot.renew.timer 2>/dev/null || systemctl enable --now certbot.timer 2>/dev/null || true

curl --fail --silent --show-error --max-time 15 "https://${DOMAIN}/release.json" >/dev/null
curl --fail --silent --show-error --max-time 15 "https://${DOMAIN}/" | grep -Fq '<meta name="aninexus-build"'
redirect="$(curl --silent --show-error --head --max-time 15 "https://${WWW_DOMAIN}/" | tr -d '\r' | awk 'tolower($1)=="location:"{print $2; exit}')"
[[ "$redirect" == "https://${DOMAIN}/" ]] || { echo "Redirect de www inesperado: ${redirect:-ausente}" >&2; exit 5; }

trap - ERR
echo "HTTPS ativo em https://${DOMAIN}/ e https://${WWW_DOMAIN}/ redirecionando para o domínio principal."
