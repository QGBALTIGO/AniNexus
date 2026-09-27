# Previsões AniNexus — pesquisa e contrato de resolução

Pesquisa verificada em 27/09/2026. Escopo: previsões recreativas, reputação sem valor monetário, integração ao catálogo e ao visual existente. Não há cadastro, voto ou outra mutação realizada no UpVer nesta pesquisa.

## Resultado da pesquisa

O produto de referência é [UpVer](https://upver.app/), com uma [categoria Animes](https://upver.app/c/animes), [tendências](https://upver.app/tendencias) e [rankings](https://upver.app/rankings?cat=animes). A navegação renderizada foi conferida em desktop e a ficha de uma previsão em mobile, além do HTML público.

Na observação, a categoria tinha 18 previsões abertas. Seus cartões combinam pergunta, consenso, variação diária, participação e encerramento. O detalhe separa material de contexto dos critérios de resolução; há argumentos e acompanhamento da previsão. A página de ranking da categoria ainda não exibia previsões resolvidas. Não foi encontrada documentação de uma API pública de integração nas páginas e pesquisas consultadas; isso não prova que não exista.

O texto de referência fornecido pelo usuário já está desatualizado em um ponto: o UpVer **já oferece confiança** em cinco níveis, de 10% a 100%. No [detalhe inspecionado](https://upver.app/m/a-estreia-mundial-do-anime-kagurabachi-sera-exibida-no-pax-a-mue1jzpp), a recompensa mostrada é proporcional à confiança; o erro desconta metade. Também foi confirmado o exemplo de consenso de 100% com apenas um participante. Estes dois comportamentos não são recomendados para copiar.

Inferência matemática própria: se a recompensa for `+c` no acerto e `−c/2` no erro, o valor esperado é `c × (1,5p − 0,5)`. Para `p > 1/3`, aumentar a confiança aumenta o retorno esperado. Essa regra não incentiva informar a probabilidade real. O MVP AniNexus deve ficar com escolha binária e precisão explicada; eventual confiança precisa de uma regra própria, como Brier/log score, com política temporal definida. A documentação do [Metaculus sobre pontuação](https://www.metaculus.com/help/scores-faq/) explica o objetivo de regras que premiam probabilidades honestas.

## AniList: autorização e significado dos dados

Os [termos oficiais](https://docs.anilist.co/guide/terms-of-use) restringem uso em trackers/listas concorrentes não complementares, além de coleta em massa e uso como armazenamento. A permissão comercial ligada à receita não substitui essa restrição. **O responsável pelo AniNexus confirmou nesta conversa que possui autorização de uso.** Isso é uma informação do responsável, não uma licença verificada de forma independente nesta pesquisa. Manter a integração dentro do escopo autorizado e guardar a comprovação operacionalmente; não colocá-la em arquivos públicos.

Não é correto transformar todos os campos do catálogo em provas de acontecimentos:

| Dado | O que permite afirmar | O que não comprova sozinho |
| --- | --- | --- |
| `startDate` | Data de lançamento registrada; pode ser parcial. | Momento do anúncio público, exibição efetiva, disponibilidade no Brasil. |
| `status` | Estado editorial atual do registro. | Horário exato de estreia ou encerramento. |
| Relação `SEQUEL` | Relação de catálogo entre duas obras. | Data em que uma continuação foi anunciada oficialmente. |
| `AiringSchedule.airingAt` | Horário previsto de exibição. | Que a transmissão realmente aconteceu sem adiamento. |
| `averageScore` | Nota ponderada informada na resposta consultada. | Nota exatamente em um instante passado sem evidência daquele instante. |
| `MediaTrend` | Estatística diária identificada por data. | Série temporal intradiária ou garantia de imutabilidade histórica. |
| `updatedAt` | Última alteração do registro. | Campo alterado, momento da alteração da nota ou momento do anúncio. |

Referências primárias: [Media](https://docs.anilist.co/reference/object/media), [FuzzyDate](https://docs.anilist.co/reference/object/fuzzydate), [MediaRelation](https://docs.anilist.co/reference/enum/mediarelation), [AiringSchedule](https://docs.anilist.co/reference/object/airingschedule) e [MediaTrend](https://docs.anilist.co/reference/object/mediatrend). A documentação de programação delimita seu compromisso aos dados futuros; portanto não deve ser tratada como arquivo comprobatório de transmissões passadas.

## Matriz de automação

| Tipo | Resolução automática | Condições mínimas |
| --- | --- | --- |
| Nota observada em janela futura | Sim; indicado para a primeira versão. | Pergunta identifica AniList, escala, operador, limiar, janela e primeira leitura válida. |
| Popularidade observada em janela futura | Tecnicamente sim, depois. | Definir a métrica como usuários com obra na lista, não audiência. Mesma política de evidência. |
| Ranking no fechamento | Depois, com conjunto congelado. | Definir temporada, formato, elegibilidade, empates e se posição vem da fonte ou cálculo AniNexus. |
| Trending diário | Depois. | Definir dia/UTC, campo diário, prazo de publicação da fonte e dados ausentes. |
| Data exata adicionada ao catálogo | Sim apenas como evento do catálogo. | Redigir como registro observado, não como anúncio oficial. Manter histórico e proteção contra voto após descoberta. |
| Anúncio oficial de continuação | Revisão ou fonte oficial estruturada. | Fonte identificada, conteúdo e data verificáveis; `SEQUEL` isolado não basta. |
| Estreia efetiva/episódio exibido | Revisão ou confirmação oficial adequada. | Horário programado e relógio decorrido não são confirmação. Definir território, fuso e pré-estreias. |
| Atraso/cancelamento | Revisão se os sinais conflitarem. | Ausência de atualização não significa cancelamento ou resposta Não. |

Esta matriz é uma proposta de engenharia baseada no significado documentado dos campos, não uma garantia de qualidade factual dos fornecedores. A [lista de critérios do Metaculus](https://www.metaculus.com/help/question-checklist/) é uma referência útil para a pergunta não prometer algo diferente da regra que efetivamente a resolve.

## Contrato recomendado para `SCORE_AT_DEADLINE`

Exemplo de redação, com valores apenas ilustrativos:

> A nota de [obra] no AniList será de pelo menos 80/100 na primeira consulta válida realizada entre 4 de outubro, 12:00 e 13:00 UTC?

O nome técnico não deve levar a interface a alegar que a nota foi capturada exatamente às 12:00. Exibir o horário local do membro na interface, mantendo também o fuso dos critérios acessível. A janela é parte imutável da pergunta desde a publicação.

1. Publicação exige nota inicial conhecida, obra elegível, prazo futuro e pergunta cuja resposta ainda não seja determinada. Datas e limiar são congelados na publicação.
2. Palpites encerram 24 horas antes do início da janela. O servidor, não o navegador ou o worker, impõe essa hora em toda escrita.
3. Uma leitura válida é uma resposta nova do fornecedor para o ID correto, com nota inteira entre 0 e 100 e sem erro GraphQL que torne o dado inconfiável. `null`, string, campo ausente e erro não viram zero. Não reutilizar cache local produzido antes da janela.
4. Registrar início/fim da consulta e instante de observação em UTC. O contrato deve usar uma definição única de observação; por exemplo, o momento em que a resposta completa é recebida. Só respostas recebidas dentro da janela são elegíveis.
5. A primeira leitura válida recebida e persistida é a evidência. Consultas simultâneas não podem eleger evidências diferentes; usar exclusão por pergunta/worker e uma resolução única transacional.
6. `score >= threshold` resolve Sim; valor menor resolve Não. **Não resolver antecipadamente:** a nota pode ultrapassar e depois cair abaixo do limiar.
7. Se não houver evidência válida até o fim da janela, anular sem afetar reputação. Não usar a próxima nota disponível como se tivesse sido observada antes. Uma falha temporária antes do fim permite retry com backoff; não é resposta Não.
8. Persistir fonte, ID, nota, critérios/versão, instantes, resultado e hash da evidência mínima normalizada. Não é necessário armazenar o catálogo inteiro ou dados pessoais de terceiros.
9. Resultado não deve mudar silenciosamente se a API corrigir dados depois. Uma correção administrativa deve ser versionada, justificável e acompanhada de recálculo idempotente e notificação.

### Casos que precisam de testes

- Voto exatamente no fechamento, cliente com relógio incorreto e duas requisições simultâneas.
- Mudança de palpite antes/depois do fechamento, conta desativada e isolamento entre usuários.
- Dois workers, retry da mesma resolução e queda após gravar resultado mas antes de notificar.
- HTTP 200 com erros GraphQL, `null`, ID errado, nota fora da faixa, timeout e resposta após o fim da janela.
- Cache anterior à janela, reinício antes/depois da janela, relógios divergentes e horário de verão na apresentação.
- Nota passa o limiar antes da janela e volta depois: não antecipar resolução.
- Nenhum voto, um voto, amostra mínima, votos removidos por abuso e resolução anulada.
- Nenhum snapshot de 24 horas atrás: exibir ausência de base, não inventar variação zero.
- Pontuação/estatísticas/notificação executadas novamente: nenhum ponto ou aviso duplicado.

## UX e reputação

- Não colocar outro painel no topo da Home. Uma seção discreta no padrão das rolagens existentes, apenas quando houver previsões reais elegíveis; página própria dentro de Comunidade e contexto da obra.
- Não publicar cartões fictícios para preencher um feed vazio. Estado vazio curto e com expectativa honesta.
- Abaixo da amostra mínima configurável, mostrar contagens em vez de chamar uma escolha de consenso. Acima dela, mostrar proporção **dos participantes**, não probabilidade objetiva do evento.
- Separar andamento da pergunta de resultado: Aberta, Palpites encerrados, Verificando, Resolvida, Anulada. Revisão pode ser uma condição operacional explícita, sem inventar resposta.
- Uma escolha por conta/pergunta, alterações apenas enquanto aberta e histórico de alteração suficiente para auditoria. Nunca cobrar, permitir comprar influência ou converter reputação em saldo/prêmio.
- Ranking inicial com mínimo de resolvidas e limite inferior de Wilson sobre acertos; exibir também numerador/denominador. Isso reduz a vantagem de amostras pequenas, mas **não corrige seleção de perguntas fáceis**, contas múltiplas ou perguntas correlacionadas. Limitar duplicatas por obra/período e tornar a fórmula pública.
- Não publicar palpites individuais por padrão nem inferir preferências da biblioteca privada sem a configuração de privacidade aplicável. Rankings devem respeitar a visibilidade do perfil.
- Notificações de resultado com deduplicação e preferência do membro. “Nova previsão” não equivale à notificação de novo episódio; são produtores distintos.

## Operação e limites

Jobs separados são responsabilidades úteis, não precisam virar sete serviços. Um worker com etapas idempotentes, trava, índices, limites por execução, observabilidade e backoff é suficiente inicialmente. Candidatos podem ser gerados em poucos lotes diários, com teto por obra e janela; a coleta prioriza perguntas abertas e próximas da resolução.

A documentação de [limites AniList](https://docs.anilist.co/guide/rate-limiting) mostrava, na consulta, operação degradada a 30 requisições/minuto; o código deve obedecer aos cabeçalhos reais e `Retry-After`, sem assumir uma taxa fixa. As [considerações de estabilidade](https://docs.anilist.co/guide/considerations) preveem indisponibilidade e redução de limites. Degradação precisa bloquear novas publicações dependentes da fonte e preservar votos já registrados.

A proposta sem dinheiro é deliberada. A [orientação atual do Google Play](https://support.google.com/googleplay/android-developer/answer/16902027?hl=en-GB) distingue previsões com transações de valor real de conteúdo sem essas transações; o piloto específico não é exigido neste segundo caso. Isso não dispensa as demais políticas, classificação e revisão do aplicativo, nem constitui garantia de aprovação.

## Evidência visual local da pesquisa

Capturas temporárias, não integrantes da aplicação:

- `C:/Users/kayky/AppData/Local/Temp/upver-animes-research.png` — feed desktop renderizado.
- `C:/Users/kayky/AppData/Local/Temp/upver-detail-research.png` — ficha mobile renderizada com confiança e critérios.

A CLI `agent-browser` não estava instalada; o navegador Chromium do Playwright já disponível no projeto foi usado como fallback. Nenhum código de aplicação foi alterado por esta pesquisa.
