# Revisão de interface e interações — 12/09/2026

Base: `0e54b1c`. Correções aplicadas nos componentes canônicos existentes, sem criar outra camada de interface.

## Causas reproduzidas e correções

| Área | Causa confirmada | Correção / regressão |
| --- | --- | --- |
| Desfavoritar personagem | A remoção tentava normalizar `metadata=null` para personagens fora do catálogo inicial e lançava TypeError antes do DELETE. | Normalização só na inclusão; remoção idempotente por usuário e personagem. Testes de anime, mangá e isolamento entre usuários na função real, mais cenário PostgreSQL no CI. |
| Respostas e impressões | A altura do avatar no cabeçalho empurrava o texto e criava uma área vazia. | Avatar e ações ancorados no cabeçalho; texto acompanha a altura real da identificação. Teste geométrico em 360, 390, 768 e 1440 px, incluindo resposta aninhada e spoiler. |
| Botões institucionais | SVG sem tamanho e estilo de traço explícitos crescia para aproximadamente 95–118 px dentro de botões de 43 px. | SVG de 17 px, sem preenchimento, com traço atual; texto e ícone centralizados sem compressão. Colabore, Contato, Quem Somos e DMCA entram na matriz de navegação e overflow. |
| Conquistas no perfil | Regra genérica de `span` anulava o grid da medalha e acrescentava margem ao símbolo. | Escopo específico no componente público; teste mede o centro de todos os símbolos. |
| Controles de fechar | Exclusões `:not(...)` davam especificidade alta à altura mínima global de botões no celular. Controles de 34 px viravam 34 × 40 px. | Fallback inteiro dentro de `:where(...)`, preservando os tamanhos explícitos dos componentes; padding e line-height dos controles corrigidos. |
| Cliques rápidos em personagens | Duas intenções podiam ultrapassar a verificação de pendência durante o await de autenticação. | Nova checagem após autenticação e descarte de elementos desconectados; Home também emite o evento compartilhado de alteração. |
| Detalhe em cache | O mesmo detalhe em cache era desenhado duas vezes na mesma chamada. | Retorno após a primeira renderização, evitando reconstrução redundante. |
| Texto e acessibilidade | “há 1 dias” e resposta sem nome acessível quando o texto estava oculto no celular. | Singular correto e aria-label independente do texto visível. |
| Âncora de Contato | O roteador interceptava `#formulario` como navegação para a raiz antes do manipulador da página. No Pages, o prefixo da base também alterava a âncora. | Links locais são preservados pela normalização e pelo clique dos roteadores. O teste clica em “Enviar mensagem”, confere o scroll e confirma que a URL não mudou, em quatro larguras. |

## Verificação local executada

- `pnpm run check`: aprovado, incluindo sintaxe, 50 folhas CSS, 72 scripts e os contratos de serviço, carregamento, biblioteca, perfis, comentários, spoilers e rotas.
- Chromium: suíte completa de `e2e`, `accessibility`, `media-actions` e `community-overview`: **134 aprovados, 5 skips condicionais, nenhuma falha** (8,5 min).
- Firefox e WebKit: recorte de navegação/scroll, elenco, botões, respostas, comentários de notícias e conquistas: **12 aprovados, 2 skips condicionais, nenhuma falha**. Os skips são o cenário autenticado de ranking Home sob a ponte estática local; esse cenário passou no Chromium completo.
- Teste final de respostas, com singular e nome acessível: **1/1 aprovado no Chromium**.
- Complemento após encontrar a âncora de Contato: navegação geral, restauração de scroll e ações institucionais nos três navegadores: **9/9 aprovados**; `check`, build e validação do artefato repetidos e aprovados.
- `build:public` e `validate:deploy`: aprovados. O build aplica um fingerprint de conteúdo comum ao shell e aos carregadores dinâmicos; não depende de aumentar manualmente cada query string.
- Inspeção visual de Colabore no celular e das respostas com spoilers realizada. Capturas ficam nos artefatos locais dos testes.

A suíte completa inclui login lento, entrada fria, saída e volta, reload do Top 100, início/restauração de scroll, identidade do renderizador, acessibilidade, conta/administração, Home, biblioteca, programação, catálogo, notícias, erros offline, cliques repetidos, isolamento anime/mangá e troca de conta durante sincronização. Os testes de navegador usam respostas controladas para reproduzir falhas; não equivalem a testar cada conta real ou cada aparelho físico.

## Publicação e limites de capacidade

O envio passa pelo workflow **AniNexus quality**, incluindo o teste PostgreSQL em schema isolado com rollback, build de container e navegadores. A VPS só deve receber o commit se esse workflow aprovar; o deploy e o SHA de `release.json` precisam ser conferidos separadamente.

Não houve teste de carga contra produção nem acesso a dados privados para fabricar resultados. O projeto já possui runner local e rampa de staging, mas esta rodada não mediu uma capacidade nova de usuários simultâneos. A agregação do ranking de personagens ainda consulta o banco a cada leitura pública: merece medição em staging antes de escolher cache/TTL ou pré-agregação, para não comprometer a atualização dos favoritos. Testes funcionais verdes não provam capacidade para 50 mil usuários, nem ausência absoluta de falhas.
