# Autenticação e dados de conta

O AniNexus usa o Clerk para identidade, verificação de e-mail, recuperação de acesso, sessões e perfil. Dados frequentes do produto — lista, favoritos, progresso, episódios, preferências e comunidade — permanecem no PostgreSQL e são ligados ao `clerk_user_id` verificado pelo backend.

## Estado seguro por padrão

O frontend só ativa conta e sincronização quando estas três condições forem verdadeiras:

1. `PUBLIC_AUTH_ENABLED=true`;
2. `PUBLIC_API_ORIGIN` usar HTTPS válido;
3. `PUBLIC_CLERK_PUBLISHABLE_KEY` for uma chave pública Clerk válida.

Sem isso, o site continua navegável e mantém lista/favoritos no dispositivo. Nenhum dado privado é enviado para a API HTTP da VPS.

## Variáveis públicas de build

- `PUBLIC_SITE_ORIGIN`: origem canônica do frontend;
- `PUBLIC_API_ORIGIN`: URL HTTPS da API, sem caminho final;
- `PUBLIC_CLERK_PUBLISHABLE_KEY`: chave pública `pk_test_…` ou `pk_live_…`;
- `PUBLIC_AUTH_ENABLED`: `true` somente após validar HTTPS e CORS.

Essas variáveis podem ser cadastradas como GitHub Actions Variables quando não forem secretas. A chave pública Clerk é publicável por definição, mas deve continuar centralizada na configuração de ambiente.

## Segredos exclusivos do backend

- `CLERK_SECRET_KEY`;
- `CLERK_WEBHOOK_SIGNING_SECRET`;
- `DATABASE_URL`;
- `IP_HASH_SALT`;
- `POSTGRES_PASSWORD` quando o Compose for utilizado.

Nunca inclua esses valores no frontend, no repositório ou nos logs. Na VPS, use um arquivo de ambiente legível apenas pelo usuário do serviço ou um gerenciador de segredos. No GitHub, use o ambiente protegido `production`.

## Origens autorizadas

`CLERK_AUTHORIZED_PARTIES` recebe uma lista separada por vírgulas, somente de origens HTTPS em produção. Inclua a origem do GitHub Pages, a origem do domínio futuro e qualquer host HTTPS de testes efetivamente utilizado. Não inclua caminhos, curingas amplos ou origens HTTP de produção.

## Configuração atual do Clerk

O projeto Clerk está vinculado à CLI oficial. O login social por GitHub está ativo; Apple, Facebook, Google e X estão desativados para não apresentar opções que o AniNexus não oferece. Telefone, nome de usuário e senha não são obrigatórios. Aplicativo autenticador e códigos de recuperação ficam disponíveis como segundo fator opcional.

A configuração declarativa está em `ops/clerk/instance-config.json` e pode ser conferida antes de aplicar com `clerk config patch --instance dev --file ops/clerk/instance-config.json --dry-run`. O arquivo contém somente política pública da instância; as chaves continuam fora do repositório.

## Webhook

Configure no painel Clerk um endpoint HTTPS para `POST /api/webhooks/clerk` e assine os eventos `user.created`, `user.updated` e `user.deleted`. A API valida a assinatura Svix/Clerk sobre o corpo bruto, registra o ID de forma idempotente e rejeita repetições ou assinaturas inválidas.

## Migração do navegador

No primeiro login, o frontend detecta lista, favoritos e episódios locais. O usuário pode importar ou ignorar. O backend aceita uma importação inicial por conta, elimina duplicações e preserva a alteração mais recente. O navegador só marca a conclusão depois da resposta bem-sucedida e não apaga a cópia local.

## Ativação e publicação

1. A CLI oficial é autenticada com `clerk auth login` e ligada ao aplicativo com `clerk init`.
2. `ops/clerk/instance-config.json` mantém o provedor GitHub e as políticas de acesso reproduzíveis.
3. As chaves do backend ficam em `/opt/aninexus/shared/.env`, com permissão `600`.
4. A API é publicada apenas em `127.0.0.1:18080` e exposta pelo Nginx em HTTPS.
5. O frontend recebe somente `PUBLIC_CLERK_PUBLISHABLE_KEY`, `PUBLIC_API_ORIGIN` e `PUBLIC_AUTH_ENABLED=true`.
6. O workflow executa testes, publica a API, valida o health check e só depois troca a versão estática.

O webhook é uma sincronização complementar. O primeiro acesso autenticado também cria ou atualiza o usuário no PostgreSQL, portanto uma indisponibilidade temporária do webhook não impede o login.
