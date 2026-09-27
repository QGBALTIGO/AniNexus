# Previsões AniNexus e espaçamento — release e evidências finais

Data: 27/09/2026.

- Runtime de regressão: `7f279fd699a8e694d6fc7d7530510e3cf2cdcb7a`.
- Commit publicado: `0902d355c8fe11cf76f0a51dc78ed868201a7139`.
- Release API/web: `20260927T204306Z-0902d355c8fe`, ativada às 20:47:43 UTC conforme o registro do deploy.
- Estado: **publicado e QA deste recorte aprovado; 105/105 testes integrados e QA live final concluídos**.
- Produção na última conferência: API/web e serviços saudáveis, worker ativo; reinício publicou zero perguntas novas, preservando as 10 existentes sem duplicação e zero votos.
- Limites: CI geral ainda sem confirmação verde; primeira resolução real futura em 05/10/2026. Não declarar a auditoria total do AniNexus concluída.
- Histórico: a release `20260927T202100Z-86286bb6c285` chegou a ser publicada e validada, mas foi substituída pelo fluxo de notícias. Sua evidência não representa a versão atualmente servida.

## Situação do deploy

### Substituição automática e proteção corrigida

O QA live da release `86286bb6c285` passou em 16 combinações. Depois disso, o fluxo de notícias substituiu a versão por `f7f7a73`. Foram identificadas duas falhas concretas de publicação: o `update-news.yml` acionava o deploy diretamente, sem passar novamente pela qualidade; além disso, seu evento `push` não restringia branches e o checkout não fixava `main`, permitindo que a automação promovesse uma branch de funcionalidade.

A release corrige esses caminhos: notícias despacham `quality.yml --ref main`, qualidade aceita `workflow_dispatch`, o push do workflow de notícias fica limitado a `main` e seu checkout usa explicitamente `main`. O gate existente de deploy depende de qualidade concluída com sucesso. Os dois testes de `tests/deployment-safety.mjs` passaram, incluindo a ordem da comparação de checksums SQL dentro da imagem antes da ativação. A execução geral do CI ainda não foi confirmada verde; o resultado desses dois testes não a substitui.

Uma proteção adicional no CI impede que os despachos frequentes de notícias cancelem uma análise de qualidade já em curso: `cancel-in-progress` ficou condicionado somente ao evento `push`, com asserção em `tests/deployment-safety.mjs`. A correção foi publicada em `main` no commit `4d5559a0dd1a2ab75128e33870e74dab088c9356`. Essa alteração é de workflow/teste, sem mudança de runtime ou necessidade de novo deploy da aplicação; o runtime servido continua `0902d355c8fe`. A confirmação de execução verde geral continua pendente.

O runtime integrado `7f279fd699a8e694d6fc7d7530510e3cf2cdcb7a` inclui o estado de `main` com Diário e Franquia, além do novo fallback de Franquia e refinamentos de Previsões. `npm run check` passou sobre esse artefato. A rodada exata foi concluída com **105/105** testes de navegador: 63 de Previsões, 6 de espaçamento, 18 de Franquia e 18 de Diário.

O commit `0902d355c8fe11cf76f0a51dc78ed868201a7139` difere do runtime acima somente em `.github/workflows/update-news.yml`, `tests/deployment-safety.mjs`, `data/news.json` e `data/trailers.json`; não há alteração adicional nos módulos de runtime de Previsões, Franquia ou Diário nesse intervalo. A comparação dos artefatos confirmou **137 arquivos HTML/JS/CSS com hashes iguais**; as diferenças de feeds verificadas ficaram em metadados `generatedAt`/`duration`. O commit realmente implantado foi confirmado separadamente na checagem servida e no QA live descritos abaixo.

### Publicação e QA final da release 0902d355c8fe

API e web foram ativadas na release `20260927T204306Z-0902d355c8fe`. A conferência anterior à ativação aprovou **35 checksums dentro da imagem**; a conferência posterior confirmou **35 migrações aplicadas**, **135 arquivos servidos com bytes exatos**, HTTPS válido e saúde de todos os serviços. O worker voltou a funcionar e, no teste de reinício, registrou `published=0`, preservando as 10 perguntas existentes sem duplicá-las. Um segundo ciclo também terminou corretamente, sem duplicatas. O banco continuou com zero votos.

O QA live final passou em **16 combinações com conta autenticada**, incluindo carregamento de três capas em mobile e oito em desktop, sem erros observados e sem requisições de escrita. A verificação complementar dos pontos de entrada confirmou três previsões na Comunidade, uma em One Piece e uma Franquia com 31 obras/30 relações. Essa rodada cobriu 390/1440 px, quatro capas no mobile e dez no desktop, também sem erros nem escritas.

São verificações de leitura reais e do código servido, não submissões de votos reais ou alterações na biblioteca do usuário. O fluxo de gravação foi coberto pelas suítes isoladas e pelos testes de concorrência em PostgreSQL. A primeira resolução real das perguntas publicadas está prevista para **05/10/2026** e ainda não ocorreu; o comportamento completo dessa resolução futura não pode ser tratado como já observado em produção.

### CI e inspeção de segredos

O job Gitleaks do CI apontou cinco achados históricos. Após inspeção, foram classificados como falsos positivos: chaves públicas de teste do Clerk, placeholder de `.env.example` e chaves de armazenamento do cliente. A correção usa fingerprints exatos em `.gitleaksignore`, sem ignorar genericamente arquivos ou classes inteiras de achados.

O binário Gitleaks 8.24.3 teve seu checksum confrontado com o oficial, e a execução local sobre o histórico completo de **1.275 commits**, com essas exceções pontuais, terminou sem vazamentos reportados. Isso não é uma garantia absoluta de ausência de segredos nem substitui o CI geral, cujo resultado verde ainda não foi confirmado.

### Evidência histórica da release 86286bb6c285

A primeira tentativa de atualização da API falhou por CRLF no empacotamento e teve rollback saudável. O pacote foi corrigido e o responsável pelo deploy confirmou a publicação da API e da web na release `20260927T202100Z-86286bb6c285`, com serviços saudáveis. Antes da ativação foram comparados 33 checksums dentro da imagem e verificados 34 arquivos de migração; a checagem posterior confirmou as 34 migrações aplicadas. O primeiro ciclo do worker publicou 10 perguntas reais, todas OPEN e com zero votos no instante da verificação.

A conferência dos 131 arquivos efetivamente servidos terminou com SHA exato e `release.json` da mesma release antes/depois. O HTTPS foi validado com certificado Let's Encrypt YE2, válido até 24/11/2026. Health, banco e cache estavam saudáveis; todos os GETs públicos verificados responderam HTTP 200 e o endpoint privado sem autenticação respondeu HTTP 401.

A validação no navegador dessa release passou em 16 combinações antes da substituição automática descrita acima. Esse resultado é histórico; a versão atual possui evidências próprias na seção de QA final, não depende da validade desta publicação antiga.

Este relatório não declara encerrada a auditoria de todo o AniNexus. As demais rotas e funções conservam os estados individuais registrados em `AUDIT_ROUTE_MATRIX.md`.

## Escopo efetivamente implementado

### Experiência e votação

A rota `/previsoes` reúne cartões no visual existente do AniNexus, filtros de descoberta e encerramento, perguntas resolvidas, histórico pessoal e ranking. O cartão explica a pergunta, o critério, a fonte, o fechamento dos palpites, a janela de leitura e, quando houver, a evidência do resultado. Não há depósito, compra de pontos, prêmio por acerto ou reputação conversível em dinheiro.

O voto é binário, Sim ou Não, com uma escolha por conta e pergunta; pode ser alterado enquanto estiver aberto. A gravação é serializada no banco e preserva o horário validado de aceitação. Visitantes podem consultar o conteúdo público, mas precisam entrar para votar. Uma falha na consulta de identidade não esconde as perguntas públicas nem autoriza um voto.

Antes de 20 palpites, são exibidas contagens em vez de uma porcentagem que sugira consenso com amostra mínima. O ranking exige pelo menos 20 previsões resolvidas elegíveis e usa o limite inferior de Wilson de 95%; não ordena somente pela porcentagem bruta. Perfis privados ou sem estatísticas públicas não entram no ranking público. Anulações não afetam a precisão.

Há seções compactas relacionadas na Home, Comunidade e aba Geral das fichas, sem espaço vazio quando não existem itens. A abertura original da Home é preservada; a continuidade permanece entre Personagens e Vencedores. Não foi reintroduzida a central pessoal no topo nem as barras vermelhas de rolagem rejeitadas.

O refinamento posterior usa a regra estruturada e imutável para apresentar a pergunta com data e hora explícitas em Brasília; regras desconhecidas ou malformadas preservam a pergunta registrada. Cartões compactos alinham seus links sem esticar cartões completos com critérios expandidos. A suíte desse refinamento passou em 63/63 testes de navegador e integra os 105/105 aprovados sobre o artefato exato.

### Automação inicial: nota observada, não anúncio presumido

O worker inicial gera apenas `SCORE_AT_DEADLINE`: uma pergunta sobre a nota média observada no AniList em uma janela explicitamente publicada. Não afirma comprovar uma estreia, transmissão, anúncio oficial ou intenção de um estúdio.

| Regra | Comportamento implementado |
| --- | --- |
| Ativação | Exige simultaneamente `PREDICTIONS_ENABLED=1` e `PREDICTIONS_ANILIST_AUTHORIZED=1`; desativado por padrão |
| Fonte | Somente `https://graphql.anilist.co`, com timeout, sem redirecionamento para outra origem |
| Descoberta | No máximo uma vez por 24 horas, com estado durável; até 20 animes em lançamento, não adultos, populares |
| Elegibilidade | Popularidade mínima de 1.000 e nota inteira entre 50 e 93; alvo de nota igual à base mais 2 pontos |
| Quantidade | Até 10 perguntas por semana ISO de resolução; no máximo uma pergunta por obra nessa semana |
| Datas | Segunda-feira às 18:00 UTC, pelo menos 48 horas adiante; palpites encerram no mínimo 24 horas antes |
| Resolução | Primeira observação válida recebida entre o prazo e uma hora depois; comparação determinística com o alvo |
| Ausência de dado | Nota ausente, resposta inválida, erro GraphQL ou indisponibilidade nunca significam Não; sem leitura válida na janela, o resultado é VOID |
| Evidência | O lote inteiro de primeiras observações é persistido atomicamente antes de tentar resolver qualquer pergunta; retomada após reinício usa a evidência preservada |
| Concorrência | Advisory lock de sessão impede dois workers ativos no mesmo job; publicação e resultado possuem proteção de idempotência |
| Fonte limitada | HTTP 429 e Retry-After são respeitados; recuo e próxima tentativa ficam persistidos |
| Operação | Ciclo de cinco minutos, lotes limitados e encerramento gracioso; sem transação de banco mantida durante requisição de rede |

O dado registrado representa a resposta da fonte recebida naquela janela, que pode refletir cache ou atualização tardia do próprio AniList. O texto do critério não promete reconstruir a nota exata em um instante passado. O core conserva evidência e hash para auditoria e não reescreve silenciosamente resultados já concluídos.

A autorização de uso do AniList foi confirmada pelo responsável pelo projeto na conversa, não verificada independentemente como documento de licença. Os limites contratuais e semânticos estão descritos em `PREVISOES_RESEARCH_20260927.md`.

### Ajuste de espaçamento

O título curto dos cards de leitura não reserva uma segunda linha vazia. Títulos longos continuam limitados a duas linhas e o gênero fica próximo ao título. A proporção da capa, largura dos cards, área de toque uniforme e rolagem horizontal foram mantidas; não houve redesign da prateleira.

## Evidência de testes

### Runtime integrado 7f279fd699a8 / release publicada 0902d355c8fe

| Camada / rodada | Resultado atual | Limite da afirmação |
| --- | --- | --- |
| Refinamento de Previsões | 63/63 | Rodada específica com perguntas em Brasília e alinhamento compacto |
| Fallback de Franquia | 21/21 | Suíte específica de preservação de referências e navegação quando o grafo está indisponível ou incompleto |
| Segurança do deploy | 2/2 | Qualidade antes do deploy, branch/checkout main e checksums de SQL antes da ativação |
| Check do pacote de runtime `7f279fd699a8` | Passou | `npm run check` no artefato; não é evidência de publicação |
| Navegador no artefato exato `7f279fd699a8` | 105/105 | 63 Previsões + 6 espaçamento + 18 Franquia + 18 Diário |
| Equivalência do frontend nos artefatos `7f279fd699a8` e `0902d355c8fe` | 137 hashes iguais | Arquivos HTML/JS/CSS; diferenças de feeds verificadas em `generatedAt`/`duration` |
| Publicação da release final | Confirmada | API/web `20260927T204306Z-0902d355c8fe`; 35 checksums na imagem, 35 migrações aplicadas e 135 arquivos servidos exatos |
| Worker em produção, reinício e segundo ciclo | Aprovado | `published=0` no reinício; segundo ciclo correto; 10 perguntas preservadas, zero duplicações observadas e zero votos |
| Navegador live autenticado | 16 combinações aprovadas | Capas: 3 mobile/8 desktop; zero erros e zero requisições de escrita |
| Integrações live | Aprovadas em 390/1440 px | Comunidade: 3 previsões; One Piece: 1; Franquia: 31 obras/30 relações; capas: 4 mobile/10 desktop; zero erros/escritas |
| Gitleaks local, histórico completo | Sem vazamentos reportados | Binário 8.24.3 verificado; 1.275 commits e cinco exceções por fingerprint após inspeção |
| CI geral | Sem confirmação verde | Não inferir aprovação total a partir das suítes locais ou de um job isolado |

Artefatos: `audit-artifacts/api-release-7f279fd699a8/`, `audit-artifacts/release-build-7f279fd699a8/`, `audit-artifacts/api-release-0902d355c8fe/` e `audit-artifacts/release-build-0902d355c8fe/`. Rodadas específicas: `audit-artifacts/predictions-final-refinement/` e `audit-artifacts/franchise-fallback/`; evidências live em `audit-artifacts/predictions-live/` e `audit-artifacts/predictions-embeds-live/`; scanner verificado em `audit-artifacts/gitleaks-8.24.3/`. Os resultados são os registrados acima, e não apenas a existência dos diretórios.

### Rodada anterior, artefato 86286bb6c285

Os totais abaixo foram consolidados pelo responsável pela execução final sobre os artefatos da release, após as correções adversariais. Não somar novamente as várias larguras percorridas dentro de cada teste como se fossem testes independentes.

| Camada | Resultado | Alcance |
| --- | --- | --- |
| Core e worker | 40/40 | Regras, horários, dados inválidos, deduplicação, backoff, interrupção e retomada |
| PostgreSQL real isolado | 40/40 | Migração, constraints, concorrência, votos, resolução, evidência e recuperação de lote |
| Navegador — Previsões | 54/54 | 18 testes em Chromium, Firefox e WebKit |
| Navegador — espaçamento | 6/6 | Dois temas em Chromium, Firefox e WebKit |
| Total de navegador | 60/60 | Artefato exato `86286bb6c285`, sem incluir rodadas antigas ou falhas anteriores |
| AniList público, somente leitura | HTTP 200 | Descoberta com 20 registros e consulta de resolução com dois IDs; sem mutação na fonte |
| Navegador live | 16 combinações aprovadas | Release `86286bb6c285` antes de ser substituída pelo workflow de notícias |

Previsões teve medidas de reflow em 320, 390, 768 e 1440 px, temas claro/escuro e capturas de 390/1440 px. O espaçamento também foi verificado em 1920 px. A cobertura da matriz histórica de 15 larguras não deve ser automaticamente atribuída a esta nova rota. São viewports em browsers automatizados, não uma certificação em todos os dispositivos físicos.

Foram exercitados visitante, identidade indisponível, voto em andamento, clique duplicado, falha de gravação, pergunta encerrada, vazio, erro/retry, funcionalidade desativada, paginação, ranking, evidência, navegação de notificação, retorno de rota, troca de aba e respostas atrasadas. A nova página passou pela análise Axe WCAG 2 A/AA e 2.1 AA incluída na suíte; isso não prova acessibilidade total do produto.

Arquivos de teste:

- `tests/predictions.mjs`
- `tests/predictions-worker.mjs`
- `tests/predictions-database.mjs`
- `tests/predictions.spec.mjs`
- `tests/home-card-spacing.spec.mjs`

Artefatos da release anterior:

- `audit-artifacts/api-release-86286bb6c285/`: pacote/API e testes da candidata.
- `audit-artifacts/release-build-86286bb6c285/`: build frontend exato.
- `audit-artifacts/predictions-release-exact/`: evidências da rodada final de navegador.
- `audit-artifacts/home-spacing-verified/`: capturas da rodada anterior específica do espaçamento; a regressão de seis testes também integra os 60 testes do artefato exato.

## Problemas encontrados na revisão adversarial e corrigidos

1. A falha ao resolver a primeira pergunta de um lote podia perder a primeira observação das seguintes. Agora todo o lote é salvo atomicamente antes de qualquer resolução; o teste A/B comprova que o reinício mantém a observação original, sem buscar outra nota para substituir o resultado.
2. A indisponibilidade da identidade podia esconder perguntas públicas. A leitura pública ficou independente, mantendo os votos bloqueados até autenticação válida.
3. A navegação para outra previsão pela notificação, com a rota já aberta, podia manter o alvo antigo. A troca de query/hash e a navegação de retorno têm regressão específica.
4. O horário podia cruzar o fechamento entre a validação do voto e o INSERT, produzindo uma aceitação depois tratada como inelegível. A gravação usa o mesmo instante validado sob lock, incluindo alterações de voto.
5. A automação editorial podia substituir a versão validada sem o gate de qualidade e promover código de outra branch. O workflow passa a despachar qualidade e fixa evento/checkout em `main`, com dois testes específicos de proteção do deploy.

## Integração com o estado atual de main

A release incorpora Diário e Franquia existentes em `main`, em vez de restaurar uma base antiga que os remova. O fallback de Franquia preserva relações conhecidas, inclusive entre anime e mangá, e a navegação por referências não resolvidas quando o grafo remoto não está disponível ou não inclui todas as relações. Ele não inventa relações nem apresenta uma ordem cronológica curada onde ela não existe.

As suítes de navegador de Franquia e Diário integram os 105/105 testes exatos aprovados. Isso substitui o recorte anterior que os deixava fora do pacote; não declara, por si só, aprovação de todas as ações de escrita reais dessas funções em produção. A Franquia teve leitura live complementar conforme descrito acima.

## Limitações explícitas

- Não estão implementados geradores automáticos de anúncios de continuação, estreias reais, atrasos, dublagem, disponibilidade em streaming, tendências ou ranking de temporada.
- O core possui um tipo de observação de data no catálogo, mas o worker inicial não o publica nem o resolve. Não apresentar isso como monitoramento de anúncios oficiais.
- A tabela de snapshots existe como base de evolução; não há coleta/cálculo de variação de consenso em 24 horas nesta entrega.
- Não há previsão com confiança percentual, argumentos comunitários, resumo da Akira, estatísticas por especialidade ou recomendações pessoais de perguntas.
- A geração inicial é somente para animes; exibir uma integração em fichas de mangá não significa que o worker já gere perguntas para mangás.
- Esta V1 automatiza somente perguntas de nota observada. A primeira resolução real é futura, em 05/10/2026; não foi antecipada, simulada como real nem declarada concluída.
- As notificações de resultado são internas ao AniNexus para os participantes. Não foram implementados push, e-mail ou alertas automáticos de novos episódios nesta release.
- A validação de interface usa fixtures para estados controlados; a validação de banco usa PostgreSQL isolado. Nenhuma delas comprova, sozinha, cookies, autenticação, assets ou jobs da nova versão em produção.
- Diário e Franquia integram a release e a regressão combinada. Importações e outras propostas não implementadas continuam fora deste escopo; os estados próprios permanecem na matriz geral.
- O QA live final foi somente leitura, inclusive com a conta autenticada. Não houve criação de votos ou mudança de biblioteca de membros para testar produção.
- O CI geral ainda não teve confirmação verde. O scanner local sem achados após as exceções verificadas não equivale a aprovação da pipeline inteira.
- Uma bateria verde não garante ausência de todo defeito futuro. Permanecem necessárias observação operacional e verificação após publicação.

## Gates de publicação e QA final

1. Concluído: correção do empacotamento e nova conferência de 35 checksums dentro da imagem antes da ativação, sem substituir silenciosamente migrações históricas.
2. Concluído no código: correções do workflow de notícias, proteção para despachos não cancelarem qualidade em curso e testes de segurança do deploy. Ainda sem confirmação verde da pipeline geral; observar a automação editorial em execuções posteriores. O ajuste final de concorrência é somente de CI, sem novo runtime.
3. Concluído: 105/105 testes exatos e equivalência de 137 arquivos HTML/JS/CSS entre os artefatos de regressão e publicação.
4. Concluído: release final API/web ativada, 35 migrações aplicadas, 135 arquivos servidos exatos, HTTPS válido, todos os serviços saudáveis e worker reiniciado e observado em segundo ciclo sem duplicar as 10 perguntas.
5. Concluído para leitura: QA live autenticado em 16 combinações e integrações Comunidade/One Piece/Franquia, sem erros e sem escritas em contas de membros.
6. Concluído: relatório e matriz atualizados com evidência E-live da release atual. A auditoria total não é declarada concluída; continuam separados o CI geral, os demais estados da matriz e a resolução real futura de 05/10/2026.

Referência de pesquisa: `PREVISOES_RESEARCH_20260927.md`. A abordagem usa os conceitos de previsões verificáveis, preservando o visual do AniNexus; não depende de scraping contínuo do UpVer nem copia seu sistema de incentivos.

