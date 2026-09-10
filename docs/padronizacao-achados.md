# Padronização de interface — achados

Data da revisão: 10 de setembro de 2026. Base comparada: `4a99ff50258b861043c066ea3b19efc88b5d68cf`.

## Superfícies canônicas

- Detalhes de anime e mangá: `preview-v22/detail-v22.js`.
- Impressões, comentários de notícias, respostas, spoilers, curtidas, denúncia, edição e moderação: `preview-v42/social-v50.js` e `preview-v42/social-v50.css`.
- Biblioteca unificada: `preview-v38/library-unified-v49.js` e `preview-v38/library-unified-v49.css`.
- Notícias: `preview-v35/news-ui-v35.js`; o leitor antigo em `preview-v22/news-v22.js` não deve voltar a assumir a rota.
- Navegação principal: `preview-v42/header-v43.js`, `preview-v44/radio-v44.js` e guardas de rota dedicados.

## Inventário encontrado

| Tema | Estado canônico | Divergência encontrada | Decisão |
| --- | --- | --- | --- |
| Datas relativas | Social V50 usa `agora`, minutos, horas, dias e data curta | Header, conquistas e comunidade mantêm funções locais equivalentes | Preservar o texto atual; extrair utilitário compartilhado apenas numa rodada visual própria, com snapshots |
| Spoiler | Trecho inline, revelação individual, ícone vetorial e teclado | Renderizadores antigos ainda contêm blocos completos de spoiler | Social V50 é o único sistema autorizado nas rotas atuais |
| Vazio | Título curto, explicação útil e uma ação | Alguns fallbacks antigos exibem só uma linha técnica | Novos estados da biblioteca distinguem vazio, carregando e falha parcial |
| Carregando | Skeleton ou mensagem contextual | Alguns loaders podiam ficar eternos | Todo loader alterado nesta rodada tem prazo e saída recuperável |
| Falha | Mensagem humana e `Tentar novamente` | Guardas antigos recarregavam o documento inteiro | Retentativa passa a ocorrer dentro da rota, preservando estado local |
| Ações sociais | SVG do sistema, rótulo acessível e confirmação destrutiva | Implementações antigas usavam emoji ou controles duplicados | Social V50 permanece como componente único |
| Identidade de rota | Dono da rota + caminho atual | Um timeout antigo podia escrever no DOM depois de outra navegação | Toda escrita dos guardas alterados valida novamente o destino |

## Restrições para as próximas mudanças visuais

1. Não criar outro `preview-vXX` para corrigir um componente já canônico.
2. Não reativar `preview-v22/news-v22.js`, o formulário de impressão antigo de `product-v42.js` ou a biblioteca antiga de `manga-v42.js` como donos de rota.
3. Alterações de tipografia, espaçamento, datas ou cores devem ser feitas no componente canônico e acompanhadas de captura desktop e móvel.
4. Estados de “sem conteúdo” não podem ser usados para esconder timeout, erro de autenticação ou falha parcial.

## Alterações desta rodada

- O catálogo agora diferencia cancelamento por troca de rota de timeout real.
- A biblioteca mostra a mídia escolhida assim que ela chega; anime não espera mangá e vice-versa.
- Uma falha secundária não apaga os dados saudáveis e ganha retentativa própria.
- Guardas de Home, notícias, autenticação e rotas dedicadas deixam de sobrescrever uma navegação mais nova.
