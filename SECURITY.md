# Segurança do AniNexus

## Relato responsável

Não publique detalhes de uma vulnerabilidade explorável em uma issue pública. Até definirmos o canal oficial de segurança do projeto, use os contatos privados do proprietário do repositório no GitHub.

Ao relatar, inclua apenas o necessário para reproduzir o problema: componente afetado, impacto, passos mínimos e versão/commit. Não acesse dados de terceiros, não persista além do necessário e não realize testes destrutivos.

## Controles previstos para produção

- autenticação com Argon2id e tokens de sessão aleatórios armazenados apenas por hash;
- cookies HttpOnly, SameSite=Strict e `__Host-` quando HTTPS estiver ativo;
- validação de origem para escritas autenticadas;
- CSP, Helmet, HSTS em HTTPS e política restritiva de permissões;
- rate limiting global e limites adicionais em login, comentários, contato, DMCA e ações administrativas;
- validação e limites de tamanho de payload com Zod;
- queries PostgreSQL parametrizadas;
- Redis/PostgreSQL sem portas públicas no Compose;
- containers sem privilégios adicionais, filesystem somente leitura onde possível e usuário não-root na aplicação;
- separação de papéis `user`, `moderator` e `admin`, com trilha de auditoria para ações editoriais/moderação;
- segredos obrigatórios por variáveis de ambiente em produção.

## Antes de produção

O preview do GitHub Pages não é o ambiente de produção e não possui autenticação real ou banco compartilhado. Antes de abrir o serviço publicamente, configurar domínio/HTTPS, `PUBLIC_ORIGIN`, `COOKIE_SECURE=true`, senhas e salts fortes, backups, WAF/CDN, monitoramento, e-mail transacional e testes de carga/segurança.
