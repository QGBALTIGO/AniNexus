# Modelo de capacidade do AniNexus

Este documento é uma hipótese de dimensionamento, não uma certificação de 60 mil usuários. Nenhum teste desta rodada foi executado contra produção ou contra provedores externos.

## O que “60 mil ativos” significa

Sessão autenticada não mantém conexão residente no Node. A carga depende da frequência de navegação e da taxa de acerto dos caches. Para um cenário de planejamento:

| Hipótese | Valor inicial |
| --- | ---: |
| Sessões ativas na janela | 60.000 |
| Janela e duração da sessão | atividade em 15 min; sessão média de 30 min |
| Sessões autenticadas | 70% |
| Uma navegação por sessão | a cada 90 s |
| Navegações médias | 667/s |
| Fator de pico | 2,0 |
| Chamadas do navegador por navegação | 3 |
| Acerto combinado de cache estático/público | 85% |
| Chamadas pessoais ou não cacheáveis | 0,35 por navegação |
| Escritas | 3% das navegações |
| Buscas distintas | 8% das navegações |
| Rádio ativo | 8% das sessões; conexão direta ao provedor, não ao Node |
| Payload API típico / cauda | 35 KiB / 250 KiB |

Com essas hipóteses, o pico bruto seria cerca de 4.000 requisições/s no edge. Depois de 85% de acerto nas leituras públicas e das chamadas pessoais, a ordem de grandeza no app seria aproximadamente 1.000–1.100 requisições/s. Isso precisa ser medido com tráfego representativo; mudar qualquer hipótese muda o resultado.

A conta do app é: pico de 1.333 navegações/s × (`2,65` chamadas públicas × `15%` de miss + `0,35` chamadas privadas) ≈ `997 req/s`. O edge ainda recebe todas as ~4.000 req/s. O PostgreSQL não deve receber automaticamente cada miss público: cache coalescido, read models e respostas estáticas precisam ser medidos separadamente. No cenário conservador em que todas as chamadas privadas e 20% dos misses públicos consultem o banco, a ordem de grandeza seria ~570 operações/s, além das escritas (~40/s no pico). Isso é projeção, não benchmark.

Distribuição inicial de navegações: Home 30%, catálogos/listas 25%, detalhes 20%, notícias/comunidade 10%, biblioteca/perfil 10% e busca/admin/outros 5%. Recursos estáticos versionados entram no pico de primeira visita/release, mas devem sair na CDN; HTML, configuração de runtime e respostas pessoais não recebem a mesma política. Não há polling periódico do app no modelo atual. Retries acrescentam até 2% somente sob falha e devem respeitar `Retry-After`.

Sensibilidade mantendo três chamadas por navegação e fator de pico 2:

| Intervalo entre navegações | Edge no pico | App com o mix/cache acima |
| --- | ---: | ---: |
| 180 s | ~2.000 req/s | ~500 req/s |
| 90 s | ~4.000 req/s | ~1.000 req/s |
| 45 s | ~8.000 req/s | ~2.000 req/s |

Pela Lei de Little, 1.100 req/s com p95 de 800 ms pode produzir perto de 880 requisições em voo. O limite de conexões HTTP, a fila do event loop e os pools precisam suportar esse pico sem empurrar latência para além dos deadlines.

## Orçamento inicial, ainda não aprovado para produção

- 6 réplicas do app, alvo inicial de 180–220 req/s por réplica em staging.
- `PG_POOL_MAX=12`: 72 conexões potenciais do app.
- Worker de notícias: 5 conexões.
- PostgreSQL `max_connections=150`, preservando margem para migração, administração e picos. Somatório normal deve ficar abaixo de 120.
- Redis compartilhado para cache, locks, rate limit e tarefas únicas. Os atuais 256 MiB não são considerados suficientes por suposição; medir `used_memory`, `evicted_keys`, hit rate e p95 antes de decidir.

Os números de réplica e pool são um ponto de partida para teste, não uma recomendação final de hardware.

## Critérios mínimos de aceite em staging

- nenhum fluxo interativo crítico fica só em loading por mais de 12 s sem conteúdo útil ou erro recuperável da rota atual;
- falha inesperada abaixo de 0,1% durante o patamar válido;
- p95 abaixo de 300 ms e p99 abaixo de 1 s nas leituras públicas cacheadas;
- p95 abaixo de 1 s e p99 abaixo de 2 s nas leituras privadas e escritas usuais;
- zero crescimento contínuo da fila do event loop;
- nenhuma exaustão do pool PostgreSQL;
- `evicted_keys`, comandos bloqueados e reconnects Redis explicados;
- taxa de acerto do cache público acima da hipótese usada no modelo;
- nenhuma multiplicação de chamadas AniList/Jikan/MAL/AnimeThemes quando réplicas aumentam;
- readiness falha em até poucos segundos quando DB ou Redis ficam indisponíveis;
- recuperação sem reload e sem interface antiga após injeção de atraso e falha.

## Método de validação

1. Rodar `pnpm load:local` contra ambiente local controlado.
2. Rodar `scripts/load/staging-ramp.k6.js` somente em staging autorizado.
3. Aumentar carga em patamares de 20%, mantendo cada patamar por pelo menos 10 minutos.
4. Executar separadamente cenário anônimo cacheável, sessão autenticada, biblioteca e rajada de navegação.
5. Parar ao primeiro limite de latência, erro, pool, CPU, memória ou provedor; registrar o gargalo antes de escalar outra camada.
6. Repetir o patamar estável por 60 minutos e depois validar degradação de uma réplica, Redis lento e PostgreSQL indisponível.

O runner Node controla requisições/s e faz uma chamada por amostra. O k6 controla por padrão chegadas de navegações e faz exatamente três chamadas por iteração; também oferece modo de VUs concorrentes. Esses números não equivalem a sessões abertas. O perfil padrão exclui rotas que podem alcançar provedores; o perfil com catálogo/leitura exige egress interceptado por fixtures.

Sem os resultados acima, a conclusão correta é “preparado para ensaio multi-réplica”, não “suporta 60 mil”.

Esses valores são SLOs definidos antes do ensaio, não resultados desta branch. Operações pesadas devem ter orçamento e fila próprios; não serão aprovadas relaxando silenciosamente as metas das rotas usuais.
