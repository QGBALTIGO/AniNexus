# Recuperação de imagens e medalhas — 12/09/2026

## Causas verificadas

- O capturador global de erros interrompia a propagação antes dos handlers de imagem dos componentes. Isso impedia fontes alternativas de notícias, banners e logos.
- A procura indiscriminada do ancestral da imagem aplicava `nx38-media-fallback` à capa quando quem falhava era o avatar sobreposto. A capa válida recebia o texto ANINEXUS.
- O estado de imagem quebrada não era removido após um novo carregamento bem-sucedido.
- No perfil público desktop, as medalhas pequenas tinham um suporte de 17 px e SVG de 23 px, deslocando o centro em 3 px nos dois eixos. A verificação anterior cobria apenas mobile.

## Correções

- Handlers locais podem tentar fontes alternativas antes do placeholder global, sem interrupção do evento.
- Apenas a imagem principal de cada contêiner pode ativar o placeholder da capa. Falhas em avatares e logos ficam isoladas.
- O evento de carregamento remove o estado de falha da imagem e do seu contêiner.
- Avatares gerados pelo componente compartilhado possuem uma mascote local de reserva. A URL original armazenada no perfil não é alterada, e uma falha da própria reserva não provoca repetição infinita.
- O SVG das medalhas acompanha as dimensões reais do suporte, preservando os tamanhos responsivos.

## Verificação

- Regressões de imagem: avatar remoto indisponível, logo indisponível, handler local de substituição, capa realmente indisponível e recuperação de uma imagem anteriormente quebrada.
- Centralização de medalhas medida em 390, 768 e 1440 px, incluindo tamanho do SVG igual ao suporte.
- Seis execuções específicas aprovadas em Chromium, Firefox e WebKit. Perfil/editor e identidade da atividade também aprovados no Chromium.
- `pnpm run check`, `build:public` e `validate:deploy` aprovados.
- As falhas de rede são simuladas nos testes. Isso não restaura arquivos externos removidos: nesses casos a reserva local garante uma apresentação utilizável sem alterar dados do usuário.

Publicação continua condicionada à aprovação da suíte completa no GitHub e ao fluxo automático da VPS.
