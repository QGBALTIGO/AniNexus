# AniNexus — auditoria funcional e visual

Data: 27/09/2026. Base inicial 6ed65bb4162c164d3b078728dfd0ade184343b90; atualização editorial 39c65a545261 incorporada sem sobrescrever notícias/trailers.

## Método

Inventário de 66 rotas, 158 arquivos ativos e 176 candidatos de API; navegador real, comparação visual, fixtures adversariais e regressão Chromium/Firefox/WebKit. Identidade e arquitetura existentes preservadas. Matriz detalhada: AUDIT_ROUTE_MATRIX.md.

Aniquim: seis páginas públicas obtidas com Scrapling e renderizadas com CSS original, scripts desativados, em 390/1440px. Home, catálogo, detalhe, programação, temporada e comunidade inspecionados. Não houve solução de CAPTCHA, acesso privado ou cópia da marca. A referência foi de hierarquia/consistência, não uma validação interativa.

## Problemas corrigidos

| Área | Causa | Correção e verificação |
|---|---|---|
| Busca de mangá | handlers v8/v23 concorrentes abriam anime e deixavam overlay | destino tipado, links nativos, fechamento antes do lazy load; reproduzido em produção |
| Busca rápida/troca de tipo | resposta antiga substituía consulta atual | geração invalidada no input e tipo capturado |
| Busca vazia/erro | resultados velhos e recuperação ruim | limpar resultados, status acessível, retry sem perder texto |
| Foco da busca | Safari não tornava botão clicado activeElement | acionador explícito, Escape/Tab e retorno testados |
| Histórico | dono antigo da rota permitia renderizador legado | atualizar dono antes dos listeners; back/forward |
| Aliases | links antigos caíam em vazio/404 | 12 canonicalizações preservando query/hash |
| Conexão Source | link sem token caía em 404 genérico | recuperação explicada na autenticação |
| Biblioteca grande | atividade inicial hidratava todo registro, gerando 429 | lote local limitado aos 80 mais recentes; teste com 2.000 registros |
| Detalhe vazio | adaptador aceitava objeto sem identidade | validar ID/tipo, preservar identidade no bridge, erro/retry |
| Detalhe concorrente | resposta tardia podia pintar outro tipo com mesmo ID | validar destino atual por ID e tipo |
| Tema claro | cores fixas incompatíveis em várias famílias | tokens e correções nos arquivos proprietários |
| Login/cadastro | tema dos widgets divergente | variáveis de aparência sem remount/perda do rascunho; Clerk real |
| Páginas legais | falta de main e desalinhamento do cabeçalho | raiz semântica e espaçamento compartilhado |
| DMCA | labels sem associação | id/for estáveis e testes de formulário |
| Contato/DMCA | fetch sem prazo e reenvio concorrente | timeout de 12s, aria-busy, prevenção de duplicação, rascunho preservado |
| Mensagem de formulário | erros técnicos ou certeza indevida após timeout | feedback público; timeout informa confirmação incerta |
| Filtro de programação | modal sem foco/semântica/Escape | diálogo rotulado, foco preso e restaurado, opções pressionadas |
| Temporadas | main novo herdava padding duplicado | regra da família com especificidade adequada |
| Busca tablet/paisagem | regra antiga ocultava botão de 721 a 1179px | visibilidade consistente; nove testes de fronteira nos três motores |
| Consentimento | título escuro sobre fundo escuro | texto explícito e tema claro completo; Axe 84/84 |
| Logos claros | marcas brancas desapareciam em blocos claros | superfície escura restrita ao contêiner da marca |
| Imagens quebradas | fallback global forçava position:relative em hero absoluto | preservar posicionamento proprietário; teste de geometria |
| Títulos muito longos | overflow escondia corte dentro do h1 | quebra de palavras e asserção de largura interna do título |
| Sinopse ausente | fallback inventava situação e descrição genérica | indisponibilidade explícita, sem status fabricado |
| Carrossel no Firefox | smooth global movia a página entre down/up | foco/histórico instantâneos; animação explícita dos componentes preservada |
| Perfil público lento | espera indefinida e resposta antiga substituindo outra rota | deadline, validação de dados, retry e guarda de geração/destino; 18 regressões nos três motores |
| Conquistas lentas | consultas sem limite e sequenciais | chamadas concorrentes com deadline, validação e recuperação |
| Descoberta/listas/temporada/programação/comunidade | consultas diretas sem prazo deixavam skeletons infinitos | JSON com deadline incluindo corpo, fallback limitado e retry |
| Contadores da descoberta | após erro, cards ainda diziam “Consultando catálogo” | loading/erro explícitos e contadores coerentes |
| Notícias | cancelamento não garantia término do carregamento | deadline que também limita provedores que não respeitam abort |
| Notícias / camada complementar | enriquecimento antigo voltava a bloquear feed e perdia atualizações progressivas | primeiro feed saudável, callback preservado e imagens assíncronas limitadas |
| Cadastro real | aceite legal em inglês | localização pt-BR explícita e invalidação do cache da tradução; formulário real verificado |

## Regressão e proteção de dados

- 1.980 capturas de visitante antes e 1.980 depois das correções principais; 15 larguras, dois temas.
- 66 jornadas de navegação com reteste das seis falhas iniciais.
- 144/144 novos testes de busca, rotas, formulários e recuperação nos três motores.
- Regressão ampliada final: 216/216 testes; depois, três testes adicionais de notícias sem depender das imagens passaram.
- 84/84 cenários Axe sem violações sérias/críticas; não equivale a certificação WCAG integral.
- 33/33 testes de conteúdo/viewport após corrigir fallback; repetição ampliada para título sem espaços.
- 18 capturas de login/cadastro reais, seis análises Axe e preservação de texto ao alternar tema.
- Conta real administradora validada em leitura. Alterações sociais, importações, permissões e administração usam fixtures ou banco transacional do CI, não membros reais.
- E2E completo local: 309 passaram, 15 condicionais foram pulados, seis falhas foram investigadas. Erros de temporada/notícias corrigidos; cenários longos receberam orçamento de teste adequado sem relaxar asserções; carrossel ganhou diagnóstico e correção própria.
- Novos testes incluídos no CI para evitar que a cobertura exista apenas nesta sessão.
- Artefatos de sessão/screenshot fora de Git, imagem Docker e publicação estática.

## Publicação e limites

Consultar FINAL_QA_REPORT.md para o estado de publicação. Nenhuma contagem de screenshots é apresentada como prova de todas as ações. Provedores externos podem mudar; esta auditoria adiciona recuperação e regressões, não uma garantia de ausência eterna de defeitos. Não foram feitos testes de carga destrutivos nem moderação em contas reais.
