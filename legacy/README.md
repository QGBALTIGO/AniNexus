# Legacy

Esta pasta guarda implementações históricas do AniNexus que não fazem parte do runtime atual.

## Regras

- Não importe arquivos de `legacy/` em código novo.
- Não faça correções de produto aqui.
- Não copie uma pasta inteira de volta para a raiz.
- Use estes arquivos apenas para consulta, comparação visual ou recuperação de uma implementação antiga.

Se alguma funcionalidade histórica precisar voltar, extraia somente a parte necessária e integre ao módulo atual responsável pela área.

## Por que isso existe

O projeto cresceu inicialmente criando uma nova pasta `preview-vXX` para cada rodada de mudanças. Isso preservou histórico, mas tornou a raiz difícil de entender. As versões totalmente substituídas foram arquivadas aqui para manter o histórico sem misturá-lo com o código executado hoje.
