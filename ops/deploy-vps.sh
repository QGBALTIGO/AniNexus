#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_ROOT='/var/www/aninexus'
readonly RELEASE_ROOT="${APP_ROOT}/releases"
readonly INCOMING_ROOT="${APP_ROOT}/incoming"
readonly CURRENT_LINK="${APP_ROOT}/current"
readonly HEALTH_ORIGIN='http://127.0.0.1'

release_id="${1:-}"
archive_arg="${2:-}"
expected_commit="${3:-}"
expected_archive_sha="${4:-}"

if [[ ! "$release_id" =~ ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7,40}$ ]]; then
  echo 'Identificador de release inválido.' >&2
  exit 2
fi
if [[ ! "$expected_commit" =~ ^[0-9a-f]{40}$ ]] || [[ ! "$expected_archive_sha" =~ ^[0-9a-f]{64}$ ]]; then
  echo 'Metadados de integridade inválidos.' >&2
  exit 2
fi

mkdir -p "$RELEASE_ROOT" "$INCOMING_ROOT"
exec 9>"${APP_ROOT}/.deploy.lock"
flock -w 180 9 || { echo 'Outro deploy ainda está em execução.' >&2; exit 3; }

archive="$(realpath -e -- "$archive_arg")"
case "$archive" in
  "${INCOMING_ROOT}"/*) ;;
  *) echo 'O pacote está fora da área de entrada autorizada.' >&2; exit 2;;
esac

actual_archive_sha="$(sha256sum "$archive" | awk '{print $1}')"
if [[ "$actual_archive_sha" != "$expected_archive_sha" ]]; then
  echo 'O checksum do pacote não confere.' >&2
  exit 4
fi

release_dir="${RELEASE_ROOT}/${release_id}"
staging_dir="${RELEASE_ROOT}/.${release_id}.staging"
temporary_link="${APP_ROOT}/.current.${release_id}"
previous_release=''
activated=0
verified=0

cleanup(){
  rm -f -- "$archive" "$temporary_link"
  if [[ -d "$staging_dir" ]]; then rm -rf -- "$staging_dir"; fi
}

rollback(){
  [[ "$activated" -eq 1 && "$verified" -eq 0 ]] || return 0
  echo 'A nova versão falhou; restaurando a anterior.' >&2
  if [[ -n "$previous_release" && -d "$previous_release" ]]; then
    ln -s "$previous_release" "$temporary_link"
    mv -Tf "$temporary_link" "$CURRENT_LINK"
  else
    rm -f -- "$CURRENT_LINK"
  fi
}

finish(){
  code=$?
  if [[ "$code" -ne 0 ]]; then rollback || true; fi
  cleanup
  exit "$code"
}
trap finish EXIT

[[ ! -e "$release_dir" ]] || { echo 'Esta release já existe.' >&2; exit 4; }
rm -rf -- "$staging_dir"
mkdir -p "$staging_dir"

python3 - "$archive" <<'PY'
import pathlib
import sys
import tarfile

with tarfile.open(sys.argv[1], 'r:gz') as package:
    members = package.getmembers()
    if not members:
        raise SystemExit('Pacote vazio.')
    for member in members:
        item = pathlib.PurePosixPath(member.name)
        if item.is_absolute() or '..' in item.parts:
            raise SystemExit(f'Caminho inseguro no pacote: {member.name}')
        if member.issym() or member.islnk() or member.isdev():
            raise SystemExit(f'Tipo de arquivo não permitido: {member.name}')
PY

tar --extract --gzip --file "$archive" --directory "$staging_dir" --no-same-owner --no-same-permissions

for required in index.html .nojekyll assets/favicon.png assets/logo.png release.json; do
  [[ -f "${staging_dir}/${required}" ]] || { echo "Arquivo obrigatório ausente: ${required}" >&2; exit 5; }
done
grep -Eiq '<!doctype html|<html' "${staging_dir}/index.html" || { echo 'index.html inválido.' >&2; exit 5; }
find "$staging_dir" -type f -name '*.css' -size 0 -print -quit | grep -q . && { echo 'CSS vazio encontrado.' >&2; exit 5; }
while IFS= read -r -d '' javascript; do node --check "$javascript" >/dev/null; done < <(find "$staging_dir" -type f -name '*.js' -print0)

python3 - "$staging_dir/release.json" "$expected_commit" "$release_id" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as release_file:
    release = json.load(release_file)
if release.get('commit') != sys.argv[2] or release.get('release') != sys.argv[3]:
    raise SystemExit('release.json não corresponde ao pacote esperado.')
PY

sudo -n /usr/sbin/nginx -t
mv "$staging_dir" "$release_dir"
if [[ -L "$CURRENT_LINK" ]]; then previous_release="$(readlink -f "$CURRENT_LINK")"; fi

ln -s "$release_dir" "$temporary_link"
mv -Tf "$temporary_link" "$CURRENT_LINK"
activated=1

health_ok=0
for attempt in {1..10}; do
  if response="$(curl --noproxy '*' --fail --silent --show-error --max-time 10 "${HEALTH_ORIGIN}/release.json")" \
    && python3 -c 'import json,sys; raise SystemExit(0 if json.loads(sys.stdin.read()).get("commit")==sys.argv[1] else 1)' "$expected_commit" <<<"$response" \
    && curl --noproxy '*' --fail --silent --show-error --max-time 10 "${HEALTH_ORIGIN}/" | grep -Fq '<meta name="aninexus-build"' \
    && curl --noproxy '*' --fail --silent --show-error --max-time 10 "${HEALTH_ORIGIN}/assets/favicon.png" >/dev/null; then
    health_ok=1
    break
  fi
  sleep 2
done
[[ "$health_ok" -eq 1 ]] || { echo 'Health check HTTP da nova versão falhou.' >&2; exit 6; }
verified=1

current_release="$(readlink -f "$CURRENT_LINK")"
mapfile -t releases < <(find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '.*' -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
for ((index=5; index<${#releases[@]}; index++)); do
  candidate="$(realpath -e -- "${releases[$index]}")"
  [[ "$candidate" != "$current_release" ]] || continue
  case "$candidate" in
    "${RELEASE_ROOT}"/*) rm -rf -- "$candidate";;
    *) echo "Release recusada durante retenção: ${candidate}" >&2; exit 7;;
  esac
done

echo "Deploy concluído: ${release_id} (${expected_commit})"
