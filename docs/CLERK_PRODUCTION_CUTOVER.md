# Clerk Production cutover — AniNexus

## Objetivo

O AniNexus guarda biblioteca, favoritos, progresso, conquistas, comunidade e preferências pelo UUID interno de `users.id`. O `clerk_user_id` é somente o vínculo de autenticação.

A instância Development do Clerk é limitada a 100 usuários e, segundo a documentação oficial do Clerk, usuários não são transferidos diretamente da instância Development para a Production. Este procedimento preserva os dados internos do AniNexus mesmo que o novo usuário Clerk receba outro `user_...`.

## Segurança do corte

A migração `038_clerk_production_identity_cutover.sql` cria um ledger de corte.

Enquanto o backend estiver usando `sk_test_`, o AniNexus captura os vínculos Development existentes. Depois que o backend passa a usar `sk_live_`, um vínculo só pode ser trocado quando:

1. o e-mail recebido do Clerk estiver verificado;
2. o e-mail corresponder ao mesmo usuário interno;
3. o `clerk_user_id` atual for exatamente o ID Development previamente registrado;
4. aquele candidato ainda não tiver sido consumido;
5. o backend estiver efetivamente em Production (`sk_live_`).

Cada usuário pode consumir o corte uma única vez.

## Ordem obrigatória

1. Publique primeiro esta versão ainda usando as chaves Development atuais.
2. Confirme que a aplicação iniciou normalmente. No startup, todos os usuários já vinculados ao Clerk Development são registrados no ledger.
3. No Clerk Dashboard, ative/configure a instância Production para `aninexus.com.br` e conclua os registros DNS exigidos pelo Clerk.
4. Configure na Production os mesmos métodos de login necessários. Provedores sociais em Production exigem credenciais próprias.
5. Crie o webhook Production apontando para:
   `https://aninexus.com.br/api/webhooks/clerk`
   Eventos: `user.created`, `user.updated`, `user.deleted`.
6. Na VPS, substitua somente pelos valores Production:
   - `CLERK_PUBLISHABLE_KEY=pk_live_...`
   - `CLERK_SECRET_KEY=sk_live_...`
   - `CLERK_WEBHOOK_SIGNING_SECRET=whsec_...`
7. No environment `production` do GitHub Actions, altere `PUBLIC_CLERK_PUBLISHABLE_KEY` para a mesma `pk_live_...`. Mantenha o ambiente de GitHub Pages separado; uma chave Production só funciona no domínio Production configurado.
8. Faça o deploy completo. O build injeta automaticamente o Frontend API (FAPI) da chave live na Content-Security-Policy.
9. As sessões Development deixam de valer. Usuários antigos devem autenticar/criar a identidade na Production usando o mesmo e-mail verificado. Na primeira autenticação válida, o AniNexus religa o novo `user_...` ao UUID interno existente, preservando os dados.

## Conferência no PostgreSQL

Antes de trocar as chaves:

```sql
SELECT
  count(*) AS candidatos,
  count(*) FILTER (WHERE production_clerk_user_id IS NULL) AS pendentes
FROM clerk_identity_cutovers;
```

Depois do corte:

```sql
SELECT
  count(*) AS candidatos,
  count(*) FILTER (WHERE production_clerk_user_id IS NOT NULL) AS migrados,
  count(*) FILTER (WHERE production_clerk_user_id IS NULL) AS pendentes
FROM clerk_identity_cutovers;
```

Para conferir que os dados continuam no mesmo usuário interno:

```sql
SELECT u.id, u.email, u.username, u.clerk_user_id, c.legacy_clerk_user_id,
       c.production_clerk_user_id, c.rebound_at
FROM users u
LEFT JOIN clerk_identity_cutovers c ON c.user_id=u.id
ORDER BY u.created_at;
```

## Importante

Não apague os usuários internos do PostgreSQL e não remova a coluna `clerk_user_id` antes do corte. O vínculo é substituído no mesmo registro de `users`; como as demais tabelas referenciam `users.id`, biblioteca, progresso, favoritos, conquistas, comentários e relações sociais permanecem associados ao mesmo UUID.

O ledger não é uma autorização permanente para trocar identidades. Depois que um candidato é consumido, uma segunda tentativa com outro ID Clerk é recusada.
