# Importação confirmada de listas

As configurações de perfil separam AniList e MyAnimeList. Ambos exigem uma lista pública, revisão da conta de origem e confirmação explícita antes de alterar a biblioteca. Não se trata de sincronização contínua.

## Fluxo

1. Escolher o serviço, usuário, animes/mangás e política de conflitos.
2. Revisar o usuário, link do perfil, contagens, exemplos e itens sem correspondência.
3. Marcar que conferiu a conta e confirmar; ou voltar para corrigir o usuário.

`POST /api/me/list-imports/preview` consulta a origem, normaliza os dados e guarda um snapshot temporário. Não escreve nas listas do usuário. O token aleatório é armazenado somente como SHA-256, vinculado ao usuário autenticado e válido por dez minutos.

`POST /api/me/list-imports/confirm` aceita apenas o token. A transação bloqueia o snapshot, importa as linhas, preserva os metadados e registra o resultado. Repetir o token concluído devolve o mesmo resultado, sem repetir a importação. Falhas antes do commit revertem as alterações.

Manter preserva os itens existentes. Substituir atualiza status, nota e progresso dos itens correspondentes, sem apagar títulos nem modificar favoritos ou reações. Animes e mangás usam tabelas e identificadores tipados separados.

## MyAnimeList

O leitor usa o perfil e as listas públicas paginadas no domínio oficial, sem senha, cookie ou redirecionamento. Respostas privadas, bloqueadas, inválidas ou páginas repetidas interrompem a revisão. A importação é limitada a 5.000 itens por revisão; listas maiores podem ser separadas por tipo.

IDs MAL não são IDs AniList. A resolução usa o cache indexado e consultas AniList em lotes de 50 IDs MAL, sempre com o tipo de mídia. Itens sem correspondência confirmada são informados antes da importação e não são inseridos com IDs improvisados. Falhas do provedor abortam a revisão, em vez de produzir uma importação silenciosamente incompleta.

A consulta externa ocorre fora da transação de escrita. A revisão tem orçamento de 90 segundos entre leitura e mapeamento; uma chamada em andamento também está limitada pelo timeout do provedor. Apenas esta rota recebe 120 segundos no proxy; as demais APIs mantêm seus limites anteriores e respostas pessoais não entram no cache público.

## Verificação

- `node --test tests/list-imports.mjs`: paginação, normalização, proteção contra respostas inválidas e mapeamento tipado.
- `MEDIA_TEST_DATABASE_URL=... node tests/media-list-database.mjs`: PostgreSQL real, migração, ausência de escrita na revisão, isolamento por usuário, expiração, repetição e conflitos.
- Playwright: cenário `AniList and MAL imports require reviewing the source account before any library write`, nos três navegadores, incluindo mobile e desktop. O provedor é simulado neste teste de interface.
- A leitura pública real e a correspondência de IDs podem ser verificadas sem importar dados para uma conta AniNexus. Importações de contas reais não fazem parte dos testes automáticos de produção.
