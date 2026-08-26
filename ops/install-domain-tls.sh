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
readonly ENV_FILE='/opt/aninexus/shared/.env'
readonly ENV_BACKUP="${BACKUP_ROOT}/api-env-domain-$(date -u +%Y%m%dT%H%M%SZ).env"
readonly API_CURRENT='/opt/aninexus/current'
env_updated=0
production_ready=0

[[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || { echo 'Domínio inválido.' >&2; exit 2; }
[[ -f "${SCRIPT_DIR}/nginx/aninexus-bootstrap.conf" && -f "${SCRIPT_DIR}/nginx/aninexus.conf" && -f "${SCRIPT_DIR}/letsencrypt/reload-aninexus-nginx" ]] || { echo 'Arquivos de TLS/Nginx ausentes.' >&2; exit 2; }

install -d -m 0755 "$ACME_ROOT/.well-known/acme-challenge" "$BACKUP_ROOT"
if [[ -f "$NGINX_TARGET" ]]; then install -m 0644 "$NGINX_TARGET" "$BACKUP_FILE"; fi
[[ -f "$ENV_FILE" ]] || { echo 'Configuração protegida da API ausente.' >&2; exit 5; }
[[ "$(stat -c '%a' "$ENV_FILE")" == '600' ]] || { echo 'A configuração protegida da API deve usar permissão 600.' >&2; exit 5; }
install -m 0600 "$ENV_FILE" "$ENV_BACKUP"

restart_api(){
  [[ -f "${API_CURRENT}/docker-compose.yml" ]] || return 0
  docker compose -p aninexus --env-file "$ENV_FILE" -f "${API_CURRENT}/docker-compose.yml" \
    up -d --no-deps --force-recreate app
}

rollback(){
  if [[ "$env_updated" -eq 1 && -f "$ENV_BACKUP" ]]; then
    install -m 0600 "$ENV_BACKUP" "$ENV_FILE"
    restart_api || true
  fi
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

python3 - "$ENV_FILE" "$DOMAIN" <<'PY'
import os
import pathlib
import sys
import tempfile

target = pathlib.Path(sys.argv[1])
domain = sys.argv[2]
lines = target.read_text(encoding='utf-8').splitlines()
values = {}
for line in lines:
    if line and not line.lstrip().startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        values[key] = value

origins = [item.strip() for item in values.get('CLERK_AUTHORIZED_PARTIES', '').split(',') if item.strip()]
for origin in (f'https://{domain}', f'https://www.{domain}', 'https://qgbaltigo.github.io'):
    if origin not in origins:
        origins.append(origin)

updates = {
    'PUBLIC_ORIGIN': f'https://{domain}',
    'PUBLIC_SITE_ORIGIN': f'https://{domain}',
    'PUBLIC_API_ORIGIN': f'https://{domain}',
    'CLERK_AUTHORIZED_PARTIES': ','.join(origins),
    'COOKIE_SECURE': 'true',
}
seen = set()
updated = []
for line in lines:
    key = line.split('=', 1)[0] if '=' in line and not line.lstrip().startswith('#') else ''
    if key in updates:
        updated.append(f'{key}={updates[key]}')
        seen.add(key)
    else:
        updated.append(line)
for key, value in updates.items():
    if key not in seen:
        updated.append(f'{key}={value}')

fd, temporary = tempfile.mkstemp(prefix='.aninexus-env-', dir=target.parent, text=True)
try:
    with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as output:
        output.write('\n'.join(updated).rstrip() + '\n')
    os.chmod(temporary, 0o600)
    os.replace(temporary, target)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
PY
env_updated=1
restart_api

echo 'Aguardando a API reiniciar e validando a produção pelo novo certificado...'
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error --max-time 15 --output /dev/null \
      --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/release.json" \
    && homepage_body="$(curl --fail --silent --show-error --max-time 15 \
      --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/")" \
    && grep -Fq '<meta name="aninexus-build"' <<<"$homepage_body" \
    && health_body="$(curl --fail --silent --show-error --max-time 15 \
      --resolve "${DOMAIN}:443:127.0.0.1" "https://${DOMAIN}/health/ready")" \
    && python3 -c 'import json,sys; body=json.load(sys.stdin); raise SystemExit(0 if body.get("ok") and body.get("db") and body.get("cache") else 1)' <<<"$health_body"; then
    production_ready=1
    break
  fi
  echo "Produção ainda não está pronta (tentativa ${attempt}/20)."
  sleep 3
done
[[ "$production_ready" -eq 1 ]] || { echo 'A produção não ficou saudável após a ativação do domínio.' >&2; exit 5; }

redirect_headers="$(curl --fail --silent --show-error --head --max-time 15 \
  --resolve "${WWW_DOMAIN}:443:127.0.0.1" "https://${WWW_DOMAIN}/")"
redirect_headers="${redirect_headers//$'\r'/}"
redirect="$(awk 'tolower($1)=="location:"{print $2; exit}' <<<"$redirect_headers")"
[[ "$redirect" == "https://${DOMAIN}/" ]] || { echo "Redirect de www inesperado: ${redirect:-ausente}" >&2; exit 5; }

trap - ERR
echo "HTTPS ativo em https://${DOMAIN}/ e https://${WWW_DOMAIN}/ redirecionando para o domínio principal."
