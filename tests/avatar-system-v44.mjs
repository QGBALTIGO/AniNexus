import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AVATAR_PRESETS, avatarForClerkUser, avatarPresetFor, avatarPresetUrl, resolvedAvatar } from '../lib/avatar.mjs';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

assert.deepEqual(AVATAR_PRESETS,['blue','mint','pink','gold','violet','teal','red','graphite']);
assert.equal(avatarPresetFor('kayky'),avatarPresetFor('kayky'));
assert.match(avatarPresetUrl('violet'),/mascot-violet\.png$/);
assert.equal(avatarForClerkUser({id:'user_example123',hasImage:false,imageUrl:'https://img.clerk.com/default.png'}).url.startsWith('/assets/avatars/'),true);
assert.equal(avatarForClerkUser({id:'user_example123',hasImage:true,imageUrl:'https://img.clerk.com/personal.png'}).url,'https://img.clerk.com/personal.png');
assert.match(resolvedAvatar({username:'novo-membro',avatar_url:null}).url,/^\/assets\/avatars\/mascot-/);

for(const preset of AVATAR_PRESETS){
  const file=path.join(root,'assets','avatars',`mascot-${preset}.png`);
  assert.equal(fs.existsSync(file),true,`missing ${file}`);
  assert.ok(fs.statSync(file).size>20_000&&fs.statSync(file).size<120_000,`unexpected avatar size: ${preset}`);
}
assert.equal(fs.existsSync(path.join(root,'assets','mascot-menu-perch-v44-2.png')),true);

const index=read('index.html'),frontend=read('preview-v44/avatar-v44.js'),auth=read('preview-v38/auth-v38.js'),profile=read('preview-v38/profile-v38.js'),css=read('preview-v44/experience-v44.css'),server=read('server.mjs');
assert.ok(index.indexOf('avatar-v44.js')<index.indexOf('auth-v38.js'),'avatar resolver must load before auth');
assert.ok(index.indexOf('drawer-mascot-perch')<index.indexOf('drawer-utilities'),'mascot must sit on the footer divider');
assert.match(index,/mascot-menu-perch-v44-2\.png/);
assert.match(frontend,/clerkUser\?\.hasImage === false/);
assert.match(auth,/await api\('\/api\/me'/);
assert.match(profile,/name="avatarPreset"/);
assert.match(profile,/data-avatar-personal/);
assert.match(profile,/avatarMode/);
assert.match(css,/\.drawer-mascot-perch img/);
assert.match(css,/pointer-events:none/);
assert.match(server,/app\.patch\('\/api\/me\/profile'/);
assert.match(server,/withActorAvatars/);

console.log('✓ avatar pessoal, presets coloridos e mascote do menu validados');
