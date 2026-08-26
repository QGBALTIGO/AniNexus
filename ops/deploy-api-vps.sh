#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_ROOT='/opt/aninexus'
readonly RELEASE_ROOT="${APP_ROOT}/releases"
readonly INCOMING_ROOT="${APP_ROOT}/incoming"
readonly SHARED_ROOT="${APP_ROOT}/shared"
readonly ENV_FILE="${SHARED_ROOT}/.env"
readonly CURRENT_LINK="${APP_ROOT}/current"
readonly COMPOSE_PROJECT='aninexus'
readonly HEALTH_URL='http://127.0.0.1:18080/health/ready'

release_id="${1:-}"
archive_arg="${2:-}"
expected_commit="${3:-}"
expected_archive_sha="${4:-}"

[[ "$release_id" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}$ ]] || { echo 'Identificador de release da API inválido.' >&2; exit 2; }
[[ "$expected_commit" =~ ^[0-9a-f]{40}$ && "$expected_archive_sha" =~ ^[0-9a-f]{64}$ ]] || { echo 'Metadados da API inválidos.' >&2; exit 2; }

install -d -m 0755 "$RELEASE_ROOT" "$INCOMING_ROOT" "$SHARED_ROOT"
[[ -f "$ENV_FILE" ]] || { echo 'Configuração protegida /opt/aninexus/shared/.env ausente.' >&2; exit 5; }
[[ "$(stat -c '%a' "$ENV_FILE")" == '600' ]] || { echo 'A configuração protegida da API deve usar permissão 600.' >&2; exit 5; }
for required in POSTGRES_PASSWORD REDIS_PASSWORD IP_HASH_SALT CLERK_PUBLISHABLE_KEY CLERK_SECRET_KEY CLERK_AUTHORIZED_PARTIES PUBLIC_ORIGIN PUBLIC_PORT; do
  grep -Eq "^${required}=.+" "$ENV_FILE" || { echo "Variável obrigatória ausente na configuração da API: ${required}" >&2; exit 5; }
done

exec 9>"${APP_ROOT}/.deploy.lock"
flock -w 300 9 || { echo 'Outro deploy da API ainda está em execução.' >&2; exit 3; }

archive="$(realpath -e -- "$archive_arg")"
case "$archive" in "${INCOMING_ROOT}"/*) ;; *) echo 'Pacote da API fora da entrada autorizada.' >&2; exit 2;; esac
[[ "$(sha256sum "$archive" | awk '{print $1}')" == "$expected_archive_sha" ]] || { echo 'Checksum da API não confere.' >&2; exit 4; }

release_dir="${RELEASE_ROOT}/${release_id}"
staging_dir="${RELEASE_ROOT}/.${release_id}.staging"
temporary_link="${APP_ROOT}/.current.${release_id}"
previous_release=''
activated=0
verified=0

compose(){ docker compose -p "$COMPOSE_PROJECT" --env-file "$ENV_FILE" -f "$1/docker-compose.yml" "${@:2}"; }
cleanup(){ rm -f -- "$archive" "$temporary_link"; [[ ! -d "$staging_dir" ]] || rm -rf -- "$staging_dir"; }
rollback(){
  [[ "$activated" -eq 1 && "$verified" -eq 0 ]] || return 0
  echo 'A API nova falhou; restaurando a anterior.' >&2
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -s "$previous_release" "$temporary_link"
    mv -Tf "$temporary_link" "$CURRENT_LINK"
    compose "$previous_release" up -d --build --remove-orphans
  else
    compose "$release_dir" down --remove-orphans || true
    rm -f -- "$CURRENT_LINK"
  fi
  [[ ! -d "$release_dir" ]] || rm -rf -- "$release_dir"
}
finish(){ code=$?; [[ "$code" -eq 0 ]] || rollback || true; cleanup; exit "$code"; }
trap finish EXIT

[[ ! -e "$release_dir" ]] || { echo 'Esta release da API já existe.' >&2; exit 4; }
rm -rf -- "$staging_dir"
mkdir -p "$staging_dir"

python3 - "$archive" <<'PY'
import pathlib,sys,tarfile
with tarfile.open(sys.argv[1],'r:gz') as package:
    members=package.getmembers()
    if not members: raise SystemExit('Pacote da API vazio.')
    for member in members:
        item=pathlib.PurePosixPath(member.name)
        if item.is_absolute() or '..' in item.parts or member.isdev() or member.issym() or member.islnk():
            raise SystemExit(f'Entrada insegura no pacote da API: {member.name}')
PY

tar --extract --gzip --file "$archive" --directory "$staging_dir" --no-same-owner --no-same-permissions
for required in Dockerfile docker-compose.yml nginx.conf package.json pnpm-lock.yaml server.mjs ops/deploy-api-vps.sh; do
  [[ -f "${staging_dir}/${required}" ]] || { echo "Arquivo obrigatório da API ausente: ${required}" >&2; exit 5; }
done
printf '%s\n' "$expected_commit" > "${staging_dir}/.deploy-commit"

compose "$staging_dir" config --quiet
compose "$staging_dir" build --pull app news-worker
mv "$staging_dir" "$release_dir"
if [[ -L "$CURRENT_LINK" ]]; then previous_release="$(readlink -f "$CURRENT_LINK")"; fi
ln -s "$release_dir" "$temporary_link"
mv -Tf "$temporary_link" "$CURRENT_LINK"
activated=1
if ! compose "$release_dir" up -d --remove-orphans; then
  compose "$release_dir" ps -a >&2 || true
  compose "$release_dir" logs --tail=120 app news-worker >&2 || true
  echo 'Os serviços da API não conseguiram iniciar.' >&2
  exit 6
fi

health_ok=0
for attempt in {1..20}; do
  if response="$(curl --fail --silent --show-error --max-time 10 "$HEALTH_URL")" \
    && python3 -c 'import json,sys; body=json.loads(sys.stdin.read()); raise SystemExit(0 if body.get("ok") and body.get("db") and body.get("cache") else 1)' <<<"$response"; then
    health_ok=1
    break
  fi
  sleep 3
done
[[ "$health_ok" -eq 1 ]] || { compose "$release_dir" logs --tail=80 app news-worker >&2 || true; echo 'Health check da API falhou.' >&2; exit 6; }
verified=1

current_release="$(readlink -f "$CURRENT_LINK")"
mapfile -t releases < <(find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
for ((index=5; index<${#releases[@]}; index++)); do
  candidate="$(realpath -e -- "${releases[$index]}")"
  [[ "$candidate" == "$current_release" || "$candidate" == "$previous_release" ]] && continue
  case "$candidate" in "${RELEASE_ROOT}"/*) rm -rf -- "$candidate";; *) echo 'Release recusada durante retenção.' >&2; exit 7;; esac
done

echo "API implantada: ${release_id} (${expected_commit})"
