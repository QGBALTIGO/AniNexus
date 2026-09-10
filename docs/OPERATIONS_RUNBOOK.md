# Runbook de operação, escala e rollback

## Antes de qualquer mudança

1. Confirmar que o destino é local ou staging. Os scripts recusam `aninexus.com.br`, `www.aninexus.com.br` e GitHub Pages.
2. Validar `docker compose config` com o arquivo de ambiente protegido.
3. Verificar o orçamento: `APP_REPLICAS × PG_POOL_MAX + NEWS_PG_POOL_MAX + 20 < POSTGRES_MAX_CONNECTIONS`.
4. Confirmar backup recente do PostgreSQL e espaço de Redis/PostgreSQL.
5. Registrar commit, configuração de réplica e janela do teste.

## Teste local seguro

Somente inspecionar a configuração:

```powershell
pnpm load:local -- --dry-run
```

Executar carga pequena contra localhost:

```powershell
$env:LOAD_TARGET='http://127.0.0.1:3000'
$env:LOAD_RPS='25'
$env:LOAD_DURATION_SECONDS='20'
pnpm load:local
```

Para staging, `LOAD_TEST_ALLOW_HOST` ou `ALLOW_HOST` deve ser exatamente o hostname aprovado. Isso é uma trava, não autorização para testar terceiros.

O perfil padrão usa somente health/readiness e leituras alimentadas por PostgreSQL local. As rotas que podem alcançar AniList ou outro provedor ficam excluídas. Para incluí-las em staging, intercepte o egress com fixtures e defina também `LOAD_INCLUDE_UPSTREAM=1` + `LOAD_UPSTREAM_ISOLATED=1` no runner Node, ou `INCLUDE_UPSTREAM=1` + `UPSTREAM_ISOLATED=1` no k6. As flags declaram isolamento; confirme-o na rede antes da carga.

O k6 executa três chamadas por iteração. O modo padrão é chegada controlada (`EXECUTOR=arrival`, `ARRIVAL_RATE=5` navegações/s, portanto 15 req/s); `EXECUTOR=vus` seleciona sessões concorrentes. Os patamares 1k–60k são um plano dependente de infraestrutura e autorização, não valores seguros para copiar no primeiro ensaio.

Durante cada patamar, preserve o log estruturado `operational metrics`: ele registra a cada minuto p95/máximo do event loop, RSS/heap, total/ociosas/em espera do pool, disponibilidade Redis e contadores de hit/miss/stale/deadline/lock. Complemente com `docker stats --no-stream`, `redis-cli INFO stats memory` e `pg_stat_activity`/`pg_stat_statements` no ambiente autorizado. Registre também métricas do gerador, especialmente `dropped_iterations`; percentis sem a taxa oferecida e atingida não aprovam um patamar.

## Subida multi-réplica

- `APP_REPLICAS` controla quantas réplicas do app o Compose inicia.
- O Nginx resolve as réplicas anunciadas pelo serviço Docker ao iniciar. Depois de mudar `APP_REPLICAS`, recrie ou recarregue o serviço `web` e confirme a distribuição antes do ensaio.
- Rate limit, cache, locks e tarefas de startup são compartilhados no Redis.
- Cada réplica abre até `PG_POOL_MAX` conexões; aumentar réplica sem reduzir pool pode derrubar o banco.

Começar com duas réplicas, validar readiness, erros e latência, e só então subir em um degrau por vez. Migrações rodam sob advisory lock e são registradas; `MIGRATION_CHECKSUM_MISMATCH` exige restaurar o arquivo e criar uma nova migração, nunca apagar o registro no impulso.

## Sinais de parada

- readiness 503;
- p95 acima de 300 ms nas leituras públicas cacheadas por dois intervalos;
- p95 acima de 1 s nas operações privadas usuais;
- falha inesperada acima de 0,1%;
- pool PostgreSQL aguardando conexão;
- Redis reconectando, expirando operações ou expulsando chaves continuamente;
- aumento inesperado de chamadas aos provedores;
- `CACHE_BUSY` frequente sem stale disponível;
- heap ou atraso do event loop crescendo sem estabilizar.

## Degradação esperada

- Redis lento: readiness falha; comandos encerram no deadline, sem fila offline ilimitada.
- Um produtor lento: seguidores usam valor stale ou recebem falha limitada; não criam avalanche no provedor.
- Anime lento e mangá saudável: a biblioteca escolhida saudável aparece sem esperar a outra.
- Troca de rota durante carregamento: o resultado antigo é descartado e não escreve no DOM.
- Resposta inválida: aparece falha recuperável, nunca uma lista vazia falsa.

## Rollback

O deploy existente mantém release anterior e já executa rollback se o health check novo falhar. Em rollback manual:

1. reduzir entrada/retirar a release do balanceador;
2. reativar a release anterior pelo mecanismo de symlink já existente;
3. subir a composição anterior e aguardar `/health/ready`;
4. comparar `X-Request-Id`, erros, DB e Redis;
5. preservar logs e métricas da release defeituosa para análise.

Migrações desta rodada são aditivas no controle. Não executar `down` destrutivo automaticamente. Se uma migração nova alterou dados, usar um plano reversível específico e backup verificado.
