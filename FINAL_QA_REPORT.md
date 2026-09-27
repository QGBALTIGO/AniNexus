# QA final do AniNexus

Data: 27/09/2026. **Correções publicadas; passagem ampla pós-publicação em andamento.** A verificação de bytes/HTTPS/API e dos painéis autenticados terminou; este registro ainda aguarda o fechamento da última rodada de capturas e navegação.

## Resultado implementado

47 grupos de problemas corrigidos, preservando a identidade e a arquitetura do produto. Abrangem busca, navegação, carregamento/recuperação, biblioteca, detalhes de anime/mangá, notícias, formulários, autenticação, conta, editor, notificações, administração, contraste, foco e estabilidade visual.

- Causas e correções: [AUDIT_REPORT.md](AUDIT_REPORT.md).
- Severidade, arquivo, rota e reteste por problema: [AUDIT_TECHNICAL_TRACE.md](AUDIT_TECHNICAL_TRACE.md).
- Rotas, viewports, falhas e componentes: [AUDIT_ROUTE_MATRIX.md](AUDIT_ROUTE_MATRIX.md).
- Tipografia, movimento e desempenho: [DESIGN_SYSTEM_AUDIT.md](DESIGN_SYSTEM_AUDIT.md).
- Como repetir a validação: [AUDIT_RUNBOOK.md](AUDIT_RUNBOOK.md).

## Release publicada e validada

Commit de runtime: `37fc09e86d1d897035a38033ead4a05fbb421df9`. Fingerprint dos assets: `89f3d6c55332`.

Build refeito a partir dos blobs Git com LF, incluindo 27 camadas ativas. 170 arquivos de entrada, 168 arquivos validados na montagem estática. Nenhuma migração SQL alterada; 33 checksums foram comparados com a produção durante a auditoria.

CI: [AniNexus quality #36332620798](https://github.com/QGBALTIGO/AniNexus/actions/runs/36332620798).

| Gate | Resultado |
|---|---|
| Sintaxe, contratos, banco isolado, migrações e build | Aprovado |
| Contêiner de produção e configuração Nginx | Aprovado |
| Catálogo Top 100 em WebKit | Aprovado |
| Chromium | 252 passaram; 6 condicionais pulados |
| Firefox | 247 passaram; 12 condicionais pulados |
| WebKit completo | 245 passaram diretamente; 1 passou após retry; 12 condicionais pulados |
| Deploy VPS | Aprovado, workflow 36334075192 |
| Bytes servidos | 126/126 coincidem; zero divergências |

Release `20260927T164024Z-37fc09e86d1d`, verificada às 16:42 UTC. Certificado autorizado para aninexus.com.br, válido até 24/11/2026; API, banco e cache saudáveis. A release permaneceu igual antes/depois da comparação.

O retry do WebKit foi investigado: o teste consultava a posição de scroll síncrona e disparava o movimento seguinte antes do frame que atualiza o cabeçalho. A pré-condição agora espera também o reset visual do componente, mantendo todas as asserções anteriores. Dez repetições WebKit sem retry passaram. Essa correção é do teste, sem alteração adicional do runtime.

## Cobertura e tentativa de encontrar novos defeitos

- 66 rotas, 15 larguras de 320 a 1920 e dois temas. A matriz foi relida após o fechamento das falhas simuladas, sem células P/F.
- 638 registros de falhas acumulados, incluindo a nova passagem de 132 cenários offline/timeout nas 66 rotas e seis retestes adicionais da comunidade. A rodada final não teve exceções JS, interface invisível/vazia, carregamento preso, vazamento de diagnóstico ou overflow nas 15 larguras.
- 66 jornadas de entrada direta, reload, busca por teclado, foco, histórico, paisagem, reflow e movimento reduzido; retestes focais após as últimas correções.
- 84 cenários Axe sem violações sérias/críticas na rodada ampla, além de testes por componente e estado autenticado. Isso não é certificação integral de acessibilidade.
- 20 estados reais autenticados verificados em leitura após publicação: conta, três abas do editor, conteúdo após rolagem, notificações e filtros. Zero mutações de produto, exceções JS ou violações graves.
- Cinco painéis administrativos reais em dois temas, somente leitura. Escritas sociais, importações, permissões e moderação ficaram em fixtures ou banco isolado.
- 18 capturas de login/cadastro reais, com preservação do rascunho ao trocar tema, localização portuguesa e seis análises de acessibilidade.
- Seis páginas públicas do Aniquim obtidas com Scrapling (HTTP 200) e renderizadas com CSS original em 390/1440. A inspeção estática guiou consistência e hierarquia; não houve cópia de marca/layout nem alegação de acesso interativo irrestrito.

Screenshots são evidência de renderização, não aprovação automática de todas as ações. As contagens de rodadas e CI se sobrepõem; não foram somadas como “bugs encontrados” ou testes únicos.

## Desempenho observado

No reteste focal, CLS da comunidade caiu de 0,180 para 0,042 no desktop e de 0,117 para 0,068 no móvel. Na biblioteca móvel, de 0,152 para 0,025. As medições são laboratoriais e variam com cache, rede e carga da máquina. A rodada ampla teve LCP entre 652 e 5636ms; não se afirma pontuação de campo, INP real ou carregamento instantâneo.

Foram observadas respostas 504 de metadados complementares do Jikan. Os fallbacks mantiveram as telas utilizáveis; a disponibilidade desse terceiro não foi classificada como um problema resolvido no provedor.

## Proteção e limites

- Sessões, capturas e traces em `audit-artifacts/`, fora do Git, Docker e pacote público. Nenhuma credencial foi adicionada ao código.
- Não foram alterados dados de membros para “provar” moderação, importação ou salvamento em produção. Esses fluxos têm testes isolados; a conta real autorizada foi usada em leitura.
- Emulação responsiva e WebKit não equivalem a teste em aparelhos Android/iOS ou em cada Telegram WebView. Não há certificação Play Store, auditoria de segurança exaustiva ou teste de carga destrutivo implícitos neste relatório.
- **Risco operacional da VPS:** disco geral em 92% (17GB livres na leitura de 16:25 UTC). A instalação AniNexus está saudável; não foram apagados arquivos de outros bots. A capacidade compartilhada precisa ser tratada separadamente antes de esgotar.
- Provedores e conteúdo externos podem mudar. As regressões adicionadas ao CI e os estados de recuperação reduzem recorrência, mas não são garantia de ausência eterna de bugs.
