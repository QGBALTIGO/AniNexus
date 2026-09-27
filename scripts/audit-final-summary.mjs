// Merge evidence from the final read-only capture partitions without counting duplicates.
import fs from 'node:fs/promises';
import {routes} from './audit-manifest.mjs';
const runs=['post-release-final','post-release-final-part1','post-release-final-part2','post-release-final-part3'];
const key=x=>`${x.route}|${x.width}|${x.theme}`,captures=new Map();
for(const run of runs){
  const source=await fs.readFile(`audit-artifacts/${run}/results.jsonl`,'utf8').catch(()=>'');
  for(const line of source.trim().split('\n').filter(Boolean)){const row=JSON.parse(line);captures.set(key(row),row)}
}
const expected=routes.flatMap(r=>[320,390,768,1440,1920].flatMap(width=>['dark','light'].map(theme=>({route:r.route,width,theme}))));
const missing=expected.filter(x=>!captures.has(key(x))),rows=expected.map(x=>captures.get(key(x))).filter(Boolean);
const problems=rows.filter(x=>x.failure||x.errors?.length||x.metrics?.brokenImages?.length||x.metrics?.unnamed?.length||x.metrics?.scrollWidth>x.width+2||x.metrics?.textLength<20).map(x=>({route:x.route,width:x.width,theme:x.theme,errors:x.errors,brokenImages:x.metrics?.brokenImages,unnamed:x.metrics?.unnamed,scrollWidth:x.metrics?.scrollWidth,textLength:x.metrics?.textLength}));
const read=async name=>JSON.parse(await fs.readFile(`audit-artifacts/${name}`,'utf8').catch(()=>'null'));
const navigation=await read('post-release-final-navigation/summary.json'),member=await read('post-release-member-panels/results.json'),admin=await read('post-release-admin-panels/results.json'),release=await read('release-verification.json');
const result={checkedAt:new Date().toISOString(),expected:expected.length,captures:rows.length,completedRoutes:routes.filter(r=>rows.filter(x=>x.route===r.route).length===10).length,missing,problems,
  navigation:{routes:navigation?.records?.length||0,failures:navigation?.records?.filter(x=>x.failure||x.errors?.length||x.checks?.length!==9)||[]},
  member:{states:member?.records?.length||0,violations:member?.records?.filter(x=>x.violations.length||x.overflow>2)||[],errors:member?.errors||[],blockedWrites:member?.blocked||[]},
  admin:{states:admin?.records?.length||0,violations:admin?.records?.filter(x=>x.violations.length)||[],errors:admin?.errors||[],blockedWrites:admin?.blocked||[]},release};
await fs.mkdir('audit-artifacts/post-release-final-all',{recursive:true});
await fs.writeFile('audit-artifacts/post-release-final-all/results.jsonl',rows.map(x=>JSON.stringify(x)).join('\n')+'\n');
await fs.writeFile('audit-artifacts/final-summary.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,missing:missing.length,release:release?{commit:release.release.commit,files:release.files,mismatches:release.mismatches,health:release.health,tls:release.certificate.authorized}:null}));
if(missing.length||problems.length||result.navigation.routes!==66||result.navigation.failures.length||result.member.states!==20||result.member.violations.length||result.member.errors.length||result.member.blockedWrites.length||result.admin.states!==10||result.admin.violations.length||result.admin.errors.length||result.admin.blockedWrites.length||!release?.health?.ok||!release?.certificate?.authorized||release?.mismatches?.length)process.exitCode=1;
