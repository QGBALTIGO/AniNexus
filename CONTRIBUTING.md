# Contribuindo com o AniNexus

O objetivo deste guia é manter o repositório simples de navegar e impedir que correções futuras voltem a criar camadas paralelas para a mesma funcionalidade.

## Antes de editar

1. Leia `docs/ARCHITECTURE.md`.
2. Descubra qual módulo já é dono da funcionalidade.
3. Evite criar novos entrypoints quando um existente pode ser atualizado.
4. Não use `legacy/` como dependência.

## Organização

- frontend/runtime compatível: `preview-vXX/` permitidos na raiz;
- histórico: `legacy/`;
- backend: `server.mjs` + `lib/`;
- banco: `sql/`;
- automações/build: `scripts/`;
- testes: `tests/`;
- documentação: `docs/`.

## Regra das versões `preview-vXX`

Não crie uma nova versão por conveniência. Uma nova pasta versionada só deve existir quando houver necessidade real de rollout/cache/compatibilidade e isso deve ser explicado no PR.

Correções normais devem acontecer no módulo atual.

## Antes de abrir PR

Rode:

```bash
npm run check
npm run build:public
```

O `check` também valida a organização da raiz e falha se uma nova camada `preview-vXX` aparecer sem ser classificada.

## Estilo

- UTF-8;
- LF;
- dois espaços para JSON/YAML/CSS/JS quando o arquivo já segue esse padrão;
- nomes descritivos;
- comentários explicam decisões, não o óbvio;
- evite duplicar lógica de estado, navegação ou chamadas de API.

## Mudanças de estrutura

Mudanças que apenas organizam arquivos devem ser separadas de alterações de funcionalidade. Isso facilita revisão e torna regressões muito mais fáceis de localizar.
