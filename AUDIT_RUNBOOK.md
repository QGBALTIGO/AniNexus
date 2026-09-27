# Reexecutar a auditoria

## Antes de publicar

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm exec playwright install chromium firefox webkit
```

Em um terminal separado, na raiz do projeto:

```powershell
$env:PORT='4174'
node scripts/audit-preview.mjs
```

O preview é local e somente leitura. Sem `AUDIT_PUBLIC_DATA=1`, não encaminha dados para a API de produção.

```powershell
pnpm exec playwright test tests/total-audit.spec.mjs tests/audit-forms.spec.mjs tests/audit-content-states.spec.mjs
node scripts/audit-chaos.mjs --scope=all --states=500,404,empty,null,offline,timeout --run=chaos-nova-rodada
```

O CI executa adicionalmente os testes completos de catálogo, biblioteca, ações, comunidade, banco isolado, contêiner, dependências e segredos. A publicação automática depende do workflow `AniNexus quality` aprovado nos três navegadores. Não substitua essa aprovação apenas por `pnpm check`.

## Depois de publicar

```powershell
node scripts/audit-build-release.mjs COMMIT_PUBLICADO
node scripts/audit-release-verify.mjs audit-artifacts/release-build-PRIMEIROS_12_CARACTERES/public
node scripts/audit-browser.mjs --mode=live --run=post-release-NOVA-RODADA --widths=320,390,768,1440,1920
$env:AUDIT_ORIGIN='https://aninexus.com.br'
node scripts/audit-navigation.mjs --run=navigation-NOVA-RODADA
Remove-Item Env:AUDIT_ORIGIN
```

Substitua os identificadores pelo commit e um nome novo de rodada. Não reutilize um diretório de captura: os arquivos JSONL acumulam registros. O verificador compara 126 arquivos de runtime, certificado, saúde e consistência da release antes/depois. O script de navegação e o de falhas retornam erro se as asserções falham; o de capturas exige também leitura dos resultados e inspeção visual, pois screenshot não é aprovação funcional.

Para nova evidência entrar na matriz, acrescente o nome da rodada às listas de `scripts/audit-inventory.mjs`, gere a matriz e releia as células P/F. Não mude uma célula para aprovado manualmente.

## Dados reais e limites

`audit-member-panels.mjs` e `audit-admin-panels.mjs` exigem sessão autorizada em `audit-artifacts/auth-state.json` e bloqueiam mutações de produto. Não clique em salvar/importar/moderar na conta de membros para produzir evidência. Use fixtures e banco isolado para isso.

`audit-artifacts/` contém evidência privada e não deve entrar em commit, imagem Docker, pacote estático ou link público. Logs de rede devem separar falha do AniNexus de indisponibilidade externa. Em uma regressão de produção, use a release anterior versionada e o rollback operacional existente; não apague dados de usuários ou os arquivos de outros bots.

Mantenha uma rodada real de dispositivo Android/iOS e WebView antes de declarar compatibilidade física ou preparar publicação em loja. Emulação de viewport e WebKit não substitui essa etapa.
