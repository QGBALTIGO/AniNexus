# Consistência visual, movimento e desempenho

Auditoria de 27/09/2026. Não foi feito redesign. Os componentes existentes foram corrigidos nos arquivos que efetivamente os controlam, preservando a identidade vermelha, o catálogo, a biblioteca e a organização editorial.

## Tipografia e tokens

- Famílias efetivamente carregadas: Manrope para títulos/controles e Nunito Sans para leitura da interface. Source Serif 4 fica restrita ao conteúdo editorial. Os três papéis são intencionais; não se adicionou outra família.
- Fontes usam `display=swap` e conexões antecipadas. A observação real confirmou fontes carregadas, não apenas declarações CSS.
- O inventário estático encontrou 14 expressões de `font-family`, 111 valores de tamanho, 47 de raio e 134 de transição. Isso inclui camadas legadas, unidades responsivas, círculos de avatar e regras sobrescritas: não representa 111 tamanhos visíveis em uma tela.
- Foram conferidos estilos computados em 36 observações de 18 famílias de páginas, nos tamanhos 390 e 1440. Tamanho zero encontrado em botões de ícone é intencional; o nome acessível foi verificado separadamente. Não se aplicou aumento global de fontes que quebraria os componentes compactos.
- As divergências realmente visíveis foram corrigidas: temas de conta/admin/notícias, avisos, campos, transferências, notificações e ações primárias. Notificações que usavam 7–9px receberam 10–13px conforme o papel.
- Superfícies, texto secundário, bordas e ações usam os tokens de cada família e tema. Não foram uniformizados indevidamente avatares circulares, chips e cards retangulares.

## Movimento e interação

- Mantidos os carrosséis, transições curtas de controles e navegação existentes; nenhum efeito decorativo novo.
- Corrigida a interferência entre rolagem suave global e clique em carrosséis no Firefox. Foco e restauração de histórico são instantâneos; animação explícita dos componentes permanece.
- Navegação testada com movimento reduzido, teclado, voltar/avançar, paisagem e reflow. Diálogos de perfil, biblioteca, busca e programação têm Escape e ciclo/restauração de foco.
- O ranking da comunidade agora reserva a geometria do pódio enquanto carrega. O placeholder não fabrica avaliações nem registros e desaparece corretamente no estado vazio/erro.
- A área principal mantém altura de viewport para evitar que o rodapé salte durante a montagem e a autenticação.

## Observações de desempenho

Script reproduzível: `scripts/audit-performance.mjs`. Chromium real, contextos novos, sem limitação artificial de rede/CPU, 6,5 segundos de observação e depois interação com a busca. Foram realizadas 36 observações de 18 famílias. TTFB observado: 79–704ms; LCP: 652–5636ms; nenhuma exceção JavaScript. A amostra mais lenta foi Home em contexto frio, com API e imagem externas participando do carregamento.

Reteste focal com o mesmo navegador e dados públicos, servindo os assets corrigidos:

| Página e largura | CLS antes | CLS depois |
|---|---:|---:|
| Comunidade, 390 | 0,117 | 0,068 |
| Comunidade, 1440 | 0,180 | 0,042 |
| Biblioteca, 390 | 0,152 | 0,025 |
| Biblioteca, 1440 | 0,025 | 0,003 |

O reteste teve LCP entre 596 e 3132ms nas seis observações focais. Variações de cache, rede, conteúdo e carga da máquina impedem tratar isso como promessa de velocidade ou experimento controlado. A maior duração de interação observada na rodada ampla foi 344ms; isso **não é INP de campo**. Recursos externos sem Timing-Allow-Origin têm tamanhos de transferência incompletos.

Houve respostas 504 do Jikan para metadados complementares e uma falha 500 externa durante a primeira passagem pública. As páginas mantiveram fallback sem exceção JavaScript ou imagem quebrada nas capturas finais. Disponibilidade desses terceiros não é controlada pelo AniNexus e não é apresentada como aprovada permanentemente.

Evidências privadas: `audit-artifacts/design-system-inventory.json`, `performance-final/results.json`, `performance-layout-retest/results.json`, `preview-layout-final/` e `test-layout-stability/`.

## Referência e limites

Aniquim foi usado para comparar hierarquia, densidade, continuidade entre catálogo/detalhe/comunidade e maturidade da apresentação. Seis páginas públicas foram lidas com Scrapling e renderizadas em duas larguras com CSS original e scripts desativados. Isso não constitui acesso autenticado ou validação de todas as interações do Aniquim.

Não houve cópia de marca, banners ou layout integral. A auditoria não afirma ausência eterna de defeitos, certificação WCAG, Web Vitals de campo ou validação em aparelhos físicos. A matriz de rotas e o QA final distinguem evidência visual, asserções e limites de execução.
