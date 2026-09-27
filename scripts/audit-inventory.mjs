// Evidence ledger; screenshots alone never mean functional approval.
import fs from 'node:fs/promises';
import { ACTIVE_PREVIEW_DIRS } from './repository-layout.mjs';
import { routes, widths, components } from './audit-manifest.mjs';
const files=['index.html','server.mjs'];
for(const dir of [...ACTIVE_PREVIEW_DIRS,'assets','lib'])for(const name of await fs.readdir(dir))if(/\.(?:js|mjs|css)$/.test(name))files.push(dir+'/'+name);
const endpoints=new Map(),candidates=new Map();
for(const file of files){
  const source=await fs.readFile(file,'utf8');
  source.split('\n').forEach((line,index)=>{
    for(const match of line.matchAll(/['"`]((?:\/)[a-zA-Z][a-zA-Z0-9_/:.?&=+#${}-]*)['"`]/g)){
      const value=match[1];if(/^\/(?:assets|data|preview-|media|profile-media)/.test(value))continue;
      const target=value.startsWith('/api/')?endpoints:candidates,items=target.get(value)||[];
      if(!items.some(item=>item.file===file))items.push({file,line:index+1});target.set(value,items);
    }
  });
}
await fs.mkdir('audit-artifacts',{recursive:true});
await fs.writeFile('audit-artifacts/inventory.json',JSON.stringify({createdAt:new Date().toISOString(),routes,widths,components,files,routeCandidates:Object.fromEntries(candidates),endpoints:Object.fromEntries(endpoints)},null,2));
async function rows(run){try{return(await fs.readFile('audit-artifacts/'+run+'/results.jsonl','utf8')).trim().split('\n').filter(Boolean).map(JSON.parse)}catch{return[]}}
const captures=[],faults=[],navigation=new Map();
for(const run of ['baseline-guest','preview-all-viewports','preview-admin-final','preview-header-final','post-release-guest','post-release-admin'])for(const item of await rows(run))captures.push({...item,run});
for(const run of ['chaos','chaos-remaining','chaos-timeout-final','chaos-detail-final','chaos-deadlines-final','chaos-final-retest','chaos-news-final'])for(const item of await rows(run))faults.push({...item,run});
for(const run of ['navigation-adversarial','navigation-header-retest','navigation-final','post-release-navigation'])for(const item of await rows(run))navigation.set(item.route,{...item,run});
const viewport=(route,width)=>{const found=captures.filter(x=>x.route===route&&x.width===width);return found.some(x=>x.run.startsWith('post-release'))?'E-live':found.some(x=>x.mode==='preview')?'E-preview':found.length?'E-base':'P'};
const fault=(route,state)=>{const x=faults.filter(x=>x.route===route&&x.state===state).at(-1);if(!x)return'P';return !x.failure&&!x.errors?.length&&!x.diagnosticLeak&&!x.unresolvedLoading&&!/Carregando perfil|Organizando suas conquistas|Consultando catálogo|Consultando seleção|Carregando ranking/.test(x.content||'')&&x.views?.every(v=>v.scrollWidth<=v.width+2)?'E-fault':'F'};
const nav=route=>{const record=navigation.get(route);return record&&!record.failure&&record.checks.length===9?'T-nav':record?.failure?'F':'P'};
const matrix=[
'# AUDIT_ROUTE_MATRIX','',
'Atualizado em '+new Date().toISOString()+'. Base inicial: 6ed65bb4162c164d3b078728dfd0ade184343b90; atualização editorial 39c65a545261 incorporada durante a auditoria.','',
'**E = evidência renderizada; T = jornada com asserções; F = falha; P = pendente.** E-preview usa correções locais e dados reais somente leitura. E-live é pós-publicação. E-fault verifica renderização, overflow, erros JS e vazamento de diagnóstico com API simulada; não aprova sozinho cada ação. Evidência privada: audit-artifacts/ (fora de Git, Docker e publicação).','',
'## Rotas × larguras','',
'| Rota | Família | '+widths.join(' | ')+' |',
'|---|---|'+widths.map(()=>'---').join('|')+'|',
...routes.map(r=>'| '+r.route+' | '+r.family+' | '+widths.map(w=>viewport(r.route,w)).join(' | ')+' |'),'',
'## Estados adversariais e navegação','',
'T-nav: entrada direta, reload, pesquisa pelo teclado e retorno do foco, voltar, avançar, paisagem 844×390, reflow 640×450, 320×568 e movimento reduzido. Reflow não é teste físico de cada dispositivo.','',
'| Rota | Navegação | 404 | 500 | Vazio | Nulo | Offline | Timeout |',
'|---|---|---|---|---|---|---|---|',
...routes.map(r=>'| '+r.route+' | '+nav(r.route)+' | '+['404','500','empty','null','offline','timeout'].map(s=>fault(r.route,s)).join(' | ')+' |'),'',
'Para páginas sem dependência de API, E-fault significa que a indisponibilidade externa não interrompe a página. Nas áreas privadas, esta passagem como visitante verifica a barreira de acesso. Estados autenticados têm fixtures próprias e leitura da conta real.','',
'## Componentes e evidência funcional','',
...Object.entries(components).flatMap(([family,items])=>['### '+family,'',items.join('; ')+'.','']),
'- Busca, aliases, histórico, detalhe vazio/retry e modal da programação: tests/total-audit.spec.mjs.',
'- Contato/DMCA: tests/audit-forms.spec.mjs (validação, sucesso, erro, timeout, rascunho, envio duplicado).',
'- Metadados parciais/longos, imagens quebradas e busca tablet: tests/audit-content-states.spec.mjs; 15 larguras, anime/mangá, dois temas; posição do botão voltar após resize.',
'- Ações de mídia: tests/media-actions.spec.mjs, tests/media-list.mjs e testes transacionais no CI.',
'- Comunidade, biblioteca, perfil privado/público/inexistente, importação com confirmação, administração e permissões: tests/e2e.spec.mjs, tests/community-overview.spec.mjs; mutações com fixtures, não em membros reais.',
'- Login/cadastro reais: real-auth-theme/ (18 capturas, rascunho preservado, seis análises Axe). Sem enviar novos códigos nem cadastrar usuários.',
'- Conta/admin reais: preview-admin-final/, somente leitura. Sem exclusões, bloqueios ou publicações de teste.',
'- Acessibilidade: 28 cenários × claro móvel/claro desktop/escuro móvel; última rodada: 84/84 sem violações sérias/críticas.',
'- Revisão visual humana: folhas das 66 rotas no escuro móvel, 39 páginas no claro móvel/desktop, oito áreas autenticadas, login/cadastro, modal de programação, fallback de detalhe e seis referências. Não se afirma revisão manual de cada pixel de cada captura.','',
'## Reconciliação de rotas dinâmicas','',
'- Detalhe: cinco obras reais e fixtures com vazio/404/500/timeout, títulos longos, imagens quebradas e resposta fora de ordem.',
'- Notícias: item real, slug inexistente, underscores, navegação concorrente, comentários simulados.',
'- Perfil: proprietário real em leitura; público/privado/inexistente e query de conquista nos E2E.',
'- /contato?assunto=colaboracao e /minha-conta#notificacoes: variantes dos fluxos correspondentes.',
'- /comments/spoiler-check, /moderation, /decision, /health e /health/ready: API ou fragmentos de API. /lib, /img/sp/icon, /wp-content, /embed, /character e /people: recursos/provedores externos. /home-loader-error: identificador de diagnóstico.',
'- 12 aliases têm regressão; light-novels e descubra aparecem nas famílias catálogo/listas.','',
'## Referência Aniquim','',
'Navegador comum bloqueado. Scrapling recuperou seis páginas públicas (HTTP 200), renderizadas localmente com CSS original e scripts desativados em 390/1440px. Home, catálogo, detalhe, programação, temporada e comunidade foram inspecionados. Comparação estática de organização e consistência, não validação interativa. Evidência: audit-artifacts/reference/.','',
'## Inventário técnico','',
files.length+' arquivos ativos; '+endpoints.size+' candidatos de API. Inventário detalhado privado: audit-artifacts/inventory.json. Status de release e limites: FINAL_QA_REPORT.md. Reexecutar o gerador após terminar as rodadas pendentes.',''
].join('\n');
await fs.writeFile('AUDIT_ROUTE_MATRIX.md',matrix);
console.log(JSON.stringify({routes:routes.length,files:files.length,endpoints:endpoints.size,captures:captures.length,faults:faults.length,navigation:[...navigation.values()].filter(x=>!x.failure).length,pendingViewportCells:routes.reduce((sum,r)=>sum+widths.filter(w=>viewport(r.route,w)==='P').length,0)}));
