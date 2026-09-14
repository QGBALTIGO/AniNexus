# Perfil público V57

O perfil público do AniNexus preserva a identidade visual do site e organiza as informações em sete áreas: visão geral, animes, mangás, favoritos, estatísticas, social e conquistas. A navegação funciona como uma única experiência responsiva, com abas roláveis no celular e estados explícitos de carregamento, vazio, erro, privacidade e perfil inexistente.

## Privacidade e dados

`GET /api/users/:username` respeita a visibilidade do perfil e as preferências `show_activity`, `show_library`, `show_stats` e `show_achievements`. Perfis privados não expõem conteúdo. As prévias de seguidores e seguindo incluem somente perfis públicos ou semipúblicos.

`GET /api/users/:username/library` entrega a biblioteca pública completa de anime ou mangá. A rota aceita `mediaType`, `status`, `q`, `limit` e `cursor`. A paginação usa o par estável `updated_at` e `media_id`, codificado em base64url; o servidor valida o cursor e busca `limit + 1` para determinar `hasMore`. A pesquisa é limitada a 80 caracteres e a página a 48 itens.

Respostas públicas permitem cache curto e revalidação. Dados pessoais ou privados não entram nesse cache. Alterações de listas continuam autenticadas e separadas deste endpoint somente de leitura.

## Experiência

- O banner mantém altura previsível, com avatar, nome, ações de seguir/compartilhar e redes sociais legíveis sobre o gradiente.
- A visão geral prioriza atividade, impressões e um resumo compacto de biblioteca e conexões.
- Animes e mangás têm busca, filtro de status e carregamento incremental sem reconstruir a página inteira.
- Favoritos separam animes, mangás e personagens; imagens preservam proporção e possuem fallback.
- Estatísticas usam elementos CSS acessíveis e textos associados, sem depender de canvas.
- Social mostra contagens e prévias; conquistas preservam os links profundos e os ícones centralizados.
- Ao abrir o perfil, a página começa no topo. Trocar de aba posiciona a navegação abaixo do cabeçalho fixo.

## Verificação

- Contratos estáticos e sintaxe: `pnpm run check`.
- Banco PostgreSQL real: `MEDIA_TEST_DATABASE_URL=... node tests/media-list-database.mjs`.
- Perfil nos navegadores: cenários Playwright contendo `public profile`, em Chromium, Firefox e WebKit.
- Imagem de produção: o workflow confirma o build e copia `preview-v44/public-profile-v57.css` de dentro do contêiner.
- Publicação: somente após todos os trabalhos obrigatórios do CI ficarem verdes, seguida de verificação do release e do perfil na produção.
