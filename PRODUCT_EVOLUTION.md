# Continuação: consistência e central pessoal

Solicitação de 27/09/2026. A evidência da auditoria anterior não encerra estes novos casos.

## Ordem de execução

1. Reproduzir os cinco prints: carregamento da conta, altura da sinopse, recomendações vazias, alinhamento das conquistas e indicador horizontal.
2. Unificar voltar/notificações, retirar os dois atalhos da abertura da home e validar claro/escuro em Chromium, Firefox e WebKit.
3. Central pessoal: continuar, agenda da lista, episódios pendentes e estreias acompanhadas, com horários/fuso explícitos e dados indisponíveis tratados sem inventar fatos.
4. Franquias: relações, lançamento, progresso da coleção e próximo título; distinguir relações da fonte de uma ordem cronológica editorial, que não pode ser deduzida com segurança.
5. Diário e retrospectivas: registros datados independentes da nota atual, episódios/capítulos, rewatch, métricas com cobertura de dados e compartilhamento opt-in.
6. Estatísticas, afinidade e recomendações explicáveis: respeitar privacidade e permitir feedback/reversão.
7. Notificações específicas e músicas: reaproveitar integrações reais e só anunciar eventos confirmados; preferências e deduplicação.
8. Importação revisável: avaliar bases existentes AniList/MAL, adicionar CSV com prévia e associações; nunca alterar a biblioteca antes da confirmação.
9. Regressão completa, nova inspeção renderizada, publicação e verificação dos arquivos servidos.

## Critérios

- Não substituir a identidade visual nem acrescentar contadores fictícios.
- Nenhuma escrita de teste na conta real ou nos membros.
- Não transformar ausência de metadados em "finalizado", zero episódios ou recomendação factual.
- Registrar quais funcionalidades têm implementação e quais ainda estão pendentes.
- Animação reduzida, teclado, estados vazio/carregando/erro e datas/fuso fazem parte de cada entrega.

## Referências consultadas

- Simkl: https://simkl.com/anime/ — continuidade e agenda pessoal.
- Letterboxd: https://letterboxd.com/about/faq/ e https://letterboxd.com/about/migrating-from-imdb/ — diário datado e revisão de importações.
- AnimeThemes: https://github.com/AnimeThemes/animethemes-api-docs/blob/main/docs/jsonapi/reference/content/index.md — obras, OP/ED, músicas, artistas e versões.
- AniDB, AniList, Anime-Planet, LiveChart e Chiaki: consulta direta bloqueada; não considerar observação interativa validada.

## Evidência da primeira etapa

- Prints: falhas reproduzidas antes da correção; 24/24 regressões passaram em Chromium, Firefox e WebKit, com reflow em 15 larguras. Revisão visual dos PNGs detectou também a sobreposição do cabeçalho na nova central, corrigida com asserção própria.
- Removidos os atalhos redundantes da abertura, vazio estreito de recomendações, altura mínima indevida da sinopse e afirmação de conclusão quando o status é desconhecido.
- Notificações compartilham símbolos semânticos; voltar em notícia/ficha usa o mesmo controle; trilhos e abas têm indicador de posição; conquistas alinham à esquerda.
- Central pessoal implementada em `/api/me/home`: consulta privada somente ao banco/cache, sem hidratação remota no caminho crítico. Anime/mangá têm identidade separada. Agenda respeita fuso, ignora horários com metadados antigos e informa que são previsões. Pendências são calculadas somente com total finalizado conhecido.
- Estado vazio, erro com recuperação, saída durante requisição, visitante e claro/escuro têm testes. A publicação desta etapa ainda depende do CI e da verificação pós-deploy.

## Franquias

- Implementado percurso limitado a 60 obras/quatro níveis do catálogo em cache, com identidades anime/mangá distintas, detecção de ciclos e aviso de cobertura parcial.
- Visualizações por sequência prequela/continuação, lançamento, filmes/especiais e spin-offs. A opção cronológica explica a ausência de curadoria; não inventa ordem narrativa a partir da data de lançamento.
- Progresso obtido em consulta privada e separada do cache público. Continuação fora da lista é sugerida quando a obra atual está concluída. Sair da conta remove a informação pessoal; sair da aba invalida respostas atrasadas.
- 12/12 cenários novos e três regressões de ficha passaram nos três motores; inspeção renderizada em claro/escuro. Unitários cobrem ciclos, limites, relações incompletas e privacidade. SQL isolado e publicação ainda em acompanhamento.

## Diário e retrospectiva

- Implementados registros privados por data, tipo de obra e intervalo de episódios/capítulos, com nota histórica, favorito, rewatch/releitura, reações e anotação protegida por spoiler. Não modificam a biblioteca atual.
- Migração 034, chave idempotente por usuário, consulta paginada por data/UUID e índice iniciando por usuário. Exclusão da conta remove os registros; exportação da conta inclui o diário. Teste PostgreSQL isolado incluído no CI, ainda aguardando execução nesta etapa.
- Semana, mês, ano e intervalo personalizado produzem um resumo somente dos registros datados. Tempo estimado fica identificado e ausência de duração não vira tempo assistido fictício. Card PNG opt-in inclui somente métricas agregadas.
- Cinco cenários passaram nos três motores; adicionados também teste de navegação voltar/avançar, foco/acessibilidade do formulário e 15 larguras. Inspeção renderizada corrigiu o bloqueio de boot da biblioteca, espaço sob o cabeçalho e gêneros em inglês.

## Publicação verificada

- Prints e central pessoal: `6fe6dff1e60585e3af430d3259ac8f616fa1c79c`, qualidade verde nos seis jobs, deploy VPS/domínio concluídos. Em 27/09 às 18:15 UTC, 129 arquivos servidos com SHA idêntico ao build LF; HTTPS autorizado e saúde de banco/cache confirmados.
- Franquias e diário: implementação local e testes em andamento; ainda não considerar publicados.

Status: implementação em andamento. Afinidade, estatísticas ampliadas, recomendações explicáveis, novas notificações e evolução de importação/músicas permanecem pendentes. A lista de execução é escopo, não comprovação de entrega.
