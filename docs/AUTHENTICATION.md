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

## Webhook

Configure no painel Clerk um endpoint HTTPS para `POST /api/webhooks/clerk` e assine os eventos `user.created`, `user.updated` e `user.deleted`. A API valida a assinatura Svix/Clerk sobre o corpo bruto, registra o ID de forma idempotente e rejeita repetições ou assinaturas inválidas.

## Migração do navegador

No primeiro login, o frontend detecta lista, favoritos e episódios locais. O usuário pode importar ou ignorar. O backend aceita uma importação inicial por conta, elimina duplicações e preserva a alteração mais recente. O navegador só marca a conclusão depois da resposta bem-sucedida e não apaga a cópia local.

## Ativação

1. Autentique a CLI oficial com `clerk auth login`.
2. No repositório, execute `clerk init --app app_3IP9Y7OjzR0p24ORDGtFZ7qvwDc` e `clerk doctor`.
3. Cadastre as variáveis e segredos acima sem copiá-los para arquivos versionados.
4. Publique a API atrás de HTTPS válido.
5. Configure o webhook e as origens autorizadas.
6. Ative `PUBLIC_AUTH_ENABLED=true`, execute os testes e faça um novo deploy pela `main`.

Se a CLI não estiver autenticada, a integração de código permanece preparada, mas login, cadastro, recuperação, sessões, exclusão real e sincronização entre dispositivos continuam deliberadamente desativados.
