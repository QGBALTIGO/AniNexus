import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const workflowSteps=()=>read('.github/workflows/deploy-vps.yml').replace(/\r\n/g,'\n').split(/^      - /m).slice(1);
const guardIds=['source_guard','upload_guard','activation_guard'];
const sha='a'.repeat(40);
const otherSha='b'.repeat(40);

async function runFreshnessGuard(id,{eventName='workflow_run',head=sha,failure}={}){
  const step=workflowSteps().find(block=>block.includes(`        id: ${id}\n`));
  assert.ok(step,`Missing deployment freshness guard: ${id}`);
  const script=step.match(/          script: \|\n((?:            [^\n]*\n?)+)/)?.[1].replace(/^            /gm,'');
  assert.ok(script,`Missing executable freshness guard: ${id}`);
  const outputs={};
  let calls=0;
  const github={rest:{git:{getRef:async options=>{
    calls++;
    assert.deepEqual(options,{owner:'fixture',repo:'aninexus',ref:'heads/main'});
    if(failure)throw failure;
    return {data:{object:{sha:head}}};
  }}}};
  const core={setOutput:(name,value)=>{outputs[name]=String(value);},info:()=>{},notice:()=>{}};
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  await new AsyncFunction('github','context','core','process',script)(github,{eventName,repo:{owner:'fixture',repo:'aninexus'}},core,{env:{DEPLOY_SHA:sha}});
  return {outputs,calls};
}

for(const id of guardIds){
  test(`${id} allows only the current main SHA for automatic deployment`,async()=>{
    const result=await runFreshnessGuard(id);
    assert.equal(result.outputs.allowed,'true');
    assert.equal(result.calls,1);
  });
  test(`${id} skips stale automatic deployment without throwing`,async()=>{
    const result=await runFreshnessGuard(id,{head:otherSha});
    assert.equal(result.outputs.allowed,'false');
  });
  test(`${id} fails closed when the current main SHA cannot be read`,async()=>{
    await assert.rejects(runFreshnessGuard(id,{failure:new Error('GitHub API unavailable')}),/GitHub API unavailable/);
    await assert.rejects(runFreshnessGuard(id,{head:null}),/Invalid main SHA/);
  });
  test(`${id} preserves explicit dispatch without consulting main`,async()=>{
    const result=await runFreshnessGuard(id,{eventName:'workflow_dispatch',head:otherSha,failure:new Error('Must not call the API')});
    assert.equal(result.outputs.allowed,'true');
    assert.equal(result.calls,0);
  });
}

test('freshness is checked again before upload and activation, while activation completes the API/frontend pair',async()=>{
  assert.equal((await runFreshnessGuard('source_guard')).outputs.allowed,'true');
  assert.equal((await runFreshnessGuard('upload_guard',{head:otherSha})).outputs.allowed,'false');
  assert.equal((await runFreshnessGuard('upload_guard')).outputs.allowed,'true');
  assert.equal((await runFreshnessGuard('activation_guard',{head:otherSha})).outputs.allowed,'false');
  const steps=workflowSteps();
  let stage;
  for(const block of steps){
    const id=block.match(/^        id: (\w+)$/m)?.[1];
    if(guardIds.includes(id)){stage=id;continue;}
    if(block.startsWith('name: Remover chave temporária')){
      assert.match(block,/if: always\(\) && steps\.upload_guard\.outputs\.allowed == 'true'/);
      continue;
    }
    assert.ok(stage,'Every deployment step must follow a freshness guard');
    assert.match(block,new RegExp(`^        if: .*steps\\.${stage}\\.outputs\\.allowed == 'true'`,'m'));
  }
});

test('scheduled news dispatches quality, never an unchecked deployment',()=>{
  const news=read('.github/workflows/update-news.yml');
  assert.match(news,/run: gh workflow run quality\.yml --ref main/);
  assert.doesNotMatch(news,/run: gh workflow run deploy-vps\.yml/);
  assert.match(news,/push:\s*\n\s+branches: \[main\]/);
  assert.match(news,/actions\/checkout@v6\s*\n\s+with:\s*\n\s+ref: main/);
  assert.match(read('.github/workflows/quality.yml'),/on:\s*\n\s+workflow_dispatch:/);
  assert.match(read('.github/workflows/quality.yml'),/cancel-in-progress: \$\{\{ github\.event_name == 'push' \}\}/);
  assert.match(read('.github/workflows/deploy-vps.yml'),/github\.event\.workflow_run\.conclusion == 'success'/);
});

test('API compares applied SQL bytes inside the built image before activation',()=>{
  const script=read('ops/deploy-api-vps.sh');
  const build=script.indexOf('compose "$staging_dir" build --pull');
  const check=script.indexOf('Migration checksum mismatch:');
  const activate=script.indexOf('mv "$staging_dir" "$release_dir"');
  assert.ok(build>=0&&check>build&&activate>check);
  assert.match(script,/SELECT name,checksum FROM aninexus_schema_migrations/);
  assert.match(script,/createHash\('sha256'\)\.update\(bytes\)/);
});

test('frontend traversal and the actual shell reader are checked before API activation',()=>{
  const api=read('ops/deploy-api-vps.sh'),frontend=read('ops/deploy-vps.sh'),quality=read('.github/workflows/quality.yml');
  const permission=api.indexOf('chmod o+x -- "$public_dir"');
  const check=api.indexOf('await readShell();');
  const activate=api.indexOf('mv "$staging_dir" "$release_dir"');
  assert.ok(permission>=0&&check>permission&&activate>check);
  assert.match(api,/createPublicShellReader\(\{file:process\.env\.PUBLIC_SHELL_PATH/);
  assert.match(frontend,/chmod o\+x -- "\$APP_ROOT" "\$RELEASE_ROOT"/);
  assert.match(quality,/\[ "\$BLOCKED" = 42 \]/);
  assert.match(quality,/--network none.*\/var\/www\/aninexus:ro/);
});

