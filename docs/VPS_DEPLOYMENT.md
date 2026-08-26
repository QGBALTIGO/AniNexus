# Deploy do AniNexus na VPS

O GitHub continua sendo a fonte oficial. A branch `main` é validada e empacotada pelo workflow `deploy-vps.yml`; nenhuma edição permanente deve ser feita dentro de `/var/www/aninexus/releases`.

O GitHub Pages é publicado separadamente pelo workflow `deploy-pages.yml`, a partir do mesmo commit e do mesmo processo de build. Assim ele continua sendo o endereço público principal enquanto a VPS funciona como origem segura da API e ambiente de teste.

## Estrutura

- Releases: `/var/www/aninexus/releases/<data-UTC>-<commit>`
- Versão ativa: `/var/www/aninexus/current`
- Pacotes recebidos: `/var/www/aninexus/incoming`
- Releases da API: `/opt/aninexus/releases/<data-UTC>-<commit>`
- API ativa: `/opt/aninexus/current`
- Configuração protegida da API: `/opt/aninexus/shared/.env` (`600`)
- Site temporário seguro: `https://187.77.255.164/`

O deploy valida código, HTML, CSS, JavaScript, referências locais, pacotes, checksum e configuração do Nginx. A API é ouvida apenas em `127.0.0.1:18080`; o Nginx oferece HTTPS e encaminha `/api` e `/health`. A ativação troca os symlinks `current` de forma atômica. Se build, banco, cache ou health check falhar, o script restaura automaticamente a versão anterior e não ativa os arquivos estáticos novos. As cinco releases mais recentes de cada camada são preservadas.

O certificado TLS temporário é emitido para o próprio IP com perfil de curta duração e renovação automática. `ops/install-ip-tls.sh` instala primeiro uma configuração HTTP de bootstrap, preserva a configuração anterior em `/var/backups/aninexus`, testa uma emissão de homologação, ativa a emissão real e só então aplica o redirecionamento HTTPS.

## Secrets do ambiente `production`

- `VPS_HOST`
- `VPS_USER`
- `VPS_PORT`
- `VPS_SSH_KEY`
- `VPS_KNOWN_HOSTS`

As variáveis públicas `PUBLIC_API_ORIGIN`, `PUBLIC_CLERK_PUBLISHABLE_KEY`, `PUBLIC_AUTH_ENABLED` e `VPS_HEALTH_ORIGIN` são lidas durante build e verificação. Somente a chave publicável do Clerk pode ir ao frontend; a chave secreta permanece exclusivamente no arquivo protegido da VPS. Consulte `docs/AUTHENTICATION.md` para a política da instância e do webhook.

## Rollback manual

Para o frontend, liste as releases em `/var/www/aninexus/releases`, escolha uma versão válida e troque o symlink com `ln -s` seguido de `mv -T`. Para a API, faça o mesmo entre `/opt/aninexus/releases` e `/opt/aninexus/current` e suba o Compose com o arquivo compartilhado de ambiente. Depois, confirme `nginx -t`, `/release.json`, `/health/ready` e a página inicial. Os scripts já executam esse procedimento automaticamente quando uma ativação falha.

## Domínio futuro

Quando houver domínio, adicione um bloco Nginx específico, emita TLS, teste HTTPS e só então altere o DNS. O GitHub Pages e o DNS atual não são modificados por este fluxo.
