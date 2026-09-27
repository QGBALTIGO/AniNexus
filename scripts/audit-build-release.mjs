// Reproduce Linux build bytes from Git blobs, independent of Windows CRLF checkout.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const ref=process.argv[2]||'origin/main';
const commit=execFileSync('git',['rev-parse',ref],{encoding:'utf8'}).trim();
const root=path.resolve('audit-artifacts',`release-build-${commit.slice(0,12)}`);
const files=execFileSync('git',['ls-tree','-r','--name-only',commit],{encoding:'utf8'}).trim().split('\n');
const selected=files.filter(file=>/^(?:preview-v\d+\/|assets\/|data\/|index\.html$|404\.html$|robots\.txt$|sitemap\.xml$|manifest\.webmanifest$|sw\.js$|\.nojekyll$|package\.json$|scripts\/(?:build-public|repository-layout|validate-static-deploy)\.mjs$)/.test(file));
for(const file of selected){
  const target=path.join(root,file);
  await fs.mkdir(path.dirname(target),{recursive:true});
  await fs.writeFile(target,execFileSync('git',['show',`${commit}:${file}`],{maxBuffer:30*1024*1024}));
}
// All values in runtime-config are intentionally public; never load server .env.
const text=await(await fetch('https://aninexus.com.br/runtime-config.js')).text();
const config=JSON.parse(text.match(/Object\.freeze\((\{.*\})\)/s)[1]);
const env={...process.env,PUBLIC_SITE_ORIGIN:config.siteOrigin,PUBLIC_API_ORIGIN:config.apiOrigin,PUBLIC_BASE_PATH:'/',PUBLIC_AUTH_ENABLED:String(config.authEnabled),PUBLIC_CLERK_PUBLISHABLE_KEY:config.clerkPublishableKey,NODE_ENV:config.environment};
process.stdout.write(execFileSync(process.execPath,['scripts/build-public.mjs'],{cwd:root,env,encoding:'utf8'}));
process.stdout.write(execFileSync(process.execPath,['scripts/validate-static-deploy.mjs','public'],{cwd:root,env,encoding:'utf8'}));
console.log(JSON.stringify({commit,files:selected.length,artifact:path.join(root,'public')}));
