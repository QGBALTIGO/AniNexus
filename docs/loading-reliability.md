# Confiabilidade de carregamento e navegação

## Verdade verificada nesta rodada

- Branch de trabalho: `codex/load-reliability-capacity`, criada sobre `5448244ad4f90d1349ebdc06b4696cbd6630a6b1`.
- Snapshot solicitado: `4a99ff50258b861043c066ea3b19efc88b5d68cf`; o checkout-base estava quatro commits adiante, com 17 arquivos alterados entre os dois pontos. Nenhum rollback foi feito.
- Runtime local: Node `v24.13.1`, pnpm `11.19.0`; contrato do projeto: Node `>=22`, `packageManager: pnpm@11.19.0`, lockfile `pnpm-lock.yaml`.
- Build no checkout e no HTML publicado consultado em 10/09/2026: `2026-09-10-v44.53.0`. A resposta pública foi HTTP 200 via Nginx e `Cache-Control: no-cache`. Esta branch ainda não foi publicada.
- Comandos suportados usados: `pnpm run check`, `node --test tests/loading-reliability.mjs`, `pnpm exec playwright test tests/e2e.spec.mjs --project=chromium` e `pnpm load:local -- --dry-run`.
- O diretório `artifacts/` já existia como trabalho não rastreado do usuário e ficou fora das alterações.

## Fluxos rastreados

| Superfície | Entrada e dono atual | Dependência principal | Estados/falhas conferidos |
| --- | --- | --- | --- |
| Home | router V23 → loader V33 → Home V35/V44 | `/api/home`, catálogo, programação | entrada fria/interna, script ausente, prazo, retry, rádio |
| Catálogos e listas | route guard V23 → catálogo V20 ou discovery/lists V44 | API própria → cache → provedores | cancelamento, timeout, retry limitado, resposta inválida |
| Temporadas/programação | guards dedicados → V18/V21/V44 | schedule/cache/provedor | URL proprietária, cache/fallback, layout responsivo |
| Detalhe anime/mangá | router V23 → detail V22 | API, elenco/equipe/franquia, social V50 | script falho, segunda tentativa, dados parciais, ausência de legado |
| Notícias | news guard V32 → news UI V35 | banco/feed nativo | entrada rápida, tela vazia, timeout e retry sem F5 |
| Comunidade/social | Community V40 + Social V50 | APIs sociais/PostgreSQL | impressão, resposta, spoiler, likes, denúncia, moderação e identidade |
| Perfil/conta/admin | auth guard + Auth/Profile/Admin V38 | Clerk → token → API → DB/cache | SDK/token pendentes, 401, timeout total, rota obsoleta |
| Biblioteca | guard V38 → Library V49 | anime e mangá privados + metadados | principal pronta/secundária pendente, erro parcial, vazio, cancelamento |
| Conquistas | router → Achievements V44 | DB + tarefa retroativa | montagem, conta, job único multi-réplica |
| Busca/menu/rádio/institucional | Header V43, router V23, radio V44, páginas dedicadas | DOM local, áudio externo direto, rotas | navegação repetida, continuidade/pausa, foco e ausência de renderer antigo |

## Resultado da investigação

O snapshot `4a99ff50258b861043c066ea3b19efc88b5d68cf` já continha parte das correções de interface, mas ainda havia quatro causas independentes para “carrega só depois de atualizar”:

1. o prazo de autenticação começava depois do SDK e do token;
2. o timeout de `fetch` nem sempre cobria a leitura do corpo;
3. a biblioteca esperava anime e mangá juntos;
4. guardas capturavam o caminho inicial e podiam escrever uma falha depois que o usuário já havia navegado.

O reaparecimento de interface antiga não era falta de cache busting: o build público já substitui versões por um fingerprint derivado do conteúdo. A causa restante era concorrência de renderizadores/guardas e escrita obsoleta no DOM.

## Contrato de prazo

`window.AniNexusRuntime.withDeadline()` cobre uma operação completa, não apenas o primeiro `fetch`:

```text
SDK -> sessão/token -> conexão -> headers -> corpo/JSON -> validação
```

- `TimeoutError`, `REQUEST_TIMEOUT`, categoria `timeout`: o prazo total terminou.
- `AbortError`, `REQUEST_CANCELLED`, categoria `navigation`: a rota ou intenção foi substituída.
- `DataError`, `INVALID_RESPONSE`, categoria `data`: houve resposta 2xx, mas o corpo não era utilizável.

O sinal externo e o timer interno são compostos por um controlador próprio. O cancelamento antigo não pode ser confundido com erro de rede e não deve exibir falha na rota nova.

## Identidade de navegação

Antes de liberar boot, emitir “ready” ou substituir `#app`, o guarda recalcula o caminho atual. Se o destino mudou, ele apenas encerra seu observer e timer. O evento `aninexus:route-ready` emitido pelo guarda representa a fase `shell`; dados completos continuam sendo responsabilidade do módulo da página.

`Tentar novamente` em Home, notícias, autenticação e rotas dedicadas dispara a renderização da rota corrente sem `location.reload()`. Favoritos, filtros, scroll e estado local não são descartados por uma falha transitória.

## Biblioteca progressiva

Anime e mangá começam em paralelo, mas a renderização espera somente a mídia selecionada. O resultado secundário atualiza o estado em segundo plano. Cada mídia mantém seus próprios campos `loading` e `error`, permitindo:

- anime saudável com mangá indisponível;
- mangá saudável com anime indisponível;
- troca de aba durante a requisição;
- cancelamento seguro ao sair ou mudar de identidade;
- retentativa sem transformar falha em coleção vazia.

## Cache, lock e réplicas

- Redis recusa fila offline e limita a fila de comandos.
- GET, SET, DEL, EVAL, ping, lock e rate limit possuem deadline.
- O produtor de cache mantém o lock renovado enquanto trabalha.
- Uma réplica seguidora aguarda resultado novo, usa stale se existir e, sem ambos, só produz depois de readquirir o lock. Ela não consulta o provedor em paralelo ao dono do lock.
- Rate limit usa um contador Lua atômico compartilhado no Redis e chaves opacas por rota.
- Migrações possuem tabela de controle e checksum sob advisory lock. Arquivo aplicado e depois alterado interrompe o startup em vez de executar DDL ambíguo.
- Prewarm e sincronização retroativa de conquistas usam marcadores distribuídos, evitando repetição em cada réplica.

## Observabilidade

Toda resposta expõe `X-Request-Id` e `Server-Timing`. O navegador pode enviar `X-AniNexus-Navigation-Id` e o build em `X-AniNexus-Client-Release`, ambos limitados a 80 caracteres seguros. Requisições acima de 1 segundo geram log estruturado com request, navegação, release do cliente, template de rota, fase `api` e duração, sem token ou corpo pessoal.

## Testes de regressão

`tests/loading-reliability.mjs` cobre timeout, sinal já cancelado, corpo JSON travado, deadline Redis, transação de migração legada, store compartilhado, proteção contra escrita obsoleta, ausência de reload e carregamento progressivo. Os testes de navegador existentes continuam cobrindo troca rápida de notícias, uma única interface por rota e matrizes de desktop/móvel.

## Evidência executada

- `pnpm run check`: aprovado, incluindo 10/10 testes novos de confiabilidade e todas as suítes unitárias/smoke existentes.
- Playwright Chromium completo, com GitHub Pages mapeado para o servidor estático local e entradas próprias em `127.0.0.1`: 83 aprovados, 6 skips condicionais e 0 falhas em 6 minutos.
- Recorte crítico (guard de erro, timeout obsoleto, biblioteca progressiva e rádio em duas abas): 4/4 aprovados.
- Runner de carga: dry-run de 500 requisições aprovado; bloqueios de produção (inclusive hostname com ponto final) e de provedores sem isolamento falharam de forma intencional.
- YAML do Compose foi parseado e os defaults de réplicas/pool/deadlines conferidos. O executável Docker não está instalado neste laboratório; `docker compose config`, Nginx em container e carga real com PostgreSQL/Redis ficam para CI/staging.
- Nenhuma carga HTTP foi executada contra produção, staging ou provedores. Portanto, a maior carga realmente validada nesta rodada é apenas a suíte funcional local; não há alegação de capacidade em RPS/sessões.
- O Codex Security não foi usado nesta continuação, conforme orientação do proprietário. A tentativa anterior não iniciou worker porque a sessão não forneceu o perfil de filesystem gerenciado exigido pelo plugin; nenhuma varredura foi fingida.
