import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('scheduled news dispatches quality, never an unchecked deployment',()=>{
  const news=read('.github/workflows/update-news.yml');
  assert.match(news,/run: gh workflow run quality\.yml --ref main/);
  assert.doesNotMatch(news,/run: gh workflow run deploy-vps\.yml/);
  assert.match(news,/push:\s*\n\s+branches: \[main\]/);
  assert.match(news,/actions\/checkout@v6\s*\n\s+with:\s*\n\s+ref: main/);
  assert.match(read('.github/workflows/quality.yml'),/on:\s*\n\s+workflow_dispatch:/);
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

