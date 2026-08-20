# AniNexus

Interface responsiva de catálogo, temporadas e programação semanal de animes.

## Rotas

- `/animes/programacao`
- `/animes/temporadas`
- `/animes/catalogo`

A programação é atualizada silenciosamente em segundo plano, sem substituir a tela por skeleton durante as atualizações periódicas.

## Executar

```bash
docker compose up -d --build
```

A aplicação ficará disponível em `http://localhost:8080`.
