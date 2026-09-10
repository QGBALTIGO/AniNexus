import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { q } from './db.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const catalogPath=path.join(__dirname,'..','data','characters.json');
const source=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const catalog=Object.freeze((Array.isArray(source?.items)?source.items:[]).map((item,index)=>Object.freeze({
  id:Number(item.id),
  name:String(item.name||'').trim(),
  nativeName:String(item.nativeName||'').trim(),
  image:String(item.image||'').trim(),
  work:String(item.work||'').trim(),
  mediaId:Number(item.mediaId)||null,
  seedOrder:Number(item.seedOrder)||index+1,
})));
const catalogById=new Map(catalog.map(item=>[item.id,item]));

if(!catalog.length||catalog.some(item=>!Number.isSafeInteger(item.id)||item.id<=0||!item.name||!item.image)||catalogById.size!==catalog.length){
  throw new Error('Invalid character ranking catalog');
}

export function hasCharacter(characterId){return catalogById.has(Number(characterId))}

function safeHttpsUrl(value){try{const url=new URL(String(value||''));return url.protocol==='https:'?url.href:''}catch{return''}}
function normalizeCandidate(item={},fallbackId=0){
  const id=Number(item.id||item.characterId||item.character_id||fallbackId),name=String(item.name||item.characterName||item.character_name||'').trim().slice(0,180);
  if(!Number.isSafeInteger(id)||id<=0||!name)return null;
  return{id,name,nativeName:String(item.nativeName||item.native_name||'').trim().slice(0,180),image:safeHttpsUrl(item.image||item.imageUrl||item.image_url),work:String(item.work||item.workTitle||item.work_title||'').trim().slice(0,240),mediaId:Number(item.mediaId||item.media_id)||null,mediaType:String(item.mediaType||item.media_type||'ANIME').toUpperCase()==='MANGA'?'MANGA':'ANIME',seedOrder:Number(item.seedOrder)||Number.MAX_SAFE_INTEGER};
}
function rankingCatalog(additions=[]){
  const merged=new Map(catalog.map(item=>[item.id,{...item}]));
  for(const raw of Array.isArray(additions)?additions:[]){const item=normalizeCandidate(raw);if(!item)continue;const previous=merged.get(item.id);merged.set(item.id,previous?{...item,...previous,image:previous.image||item.image,work:previous.work||item.work,nativeName:previous.nativeName||item.nativeName}:item)}
  return[...merged.values()];
}

export function rankCharacterCatalog(counts=new Map(),limit=10,additions=[]){
  const normalized=counts instanceof Map?counts:new Map(Object.entries(counts||{}).map(([id,count])=>[Number(id),Number(count)||0]));
  return rankingCatalog(additions)
    .map(item=>({...item,favoriteCount:Math.max(0,Number(normalized.get(item.id))||0)}))
    .sort((a,b)=>b.favoriteCount-a.favoriteCount||a.seedOrder-b.seedOrder||a.id-b.id)
    .slice(0,Math.max(1,Math.min(100,Number(limit)||10)))
    .map((item,index)=>({...item,rank:index+1}));
}

export async function getCharacterRanking(limit=10){
  const {rows}=await q(`SELECT character_id,count(*)::int AS favorite_count,
    max(character_name) FILTER (WHERE character_name IS NOT NULL) AS name,
    max(native_name) FILTER (WHERE native_name IS NOT NULL) AS native_name,
    max(image_url) FILTER (WHERE image_url IS NOT NULL) AS image_url,
    max(work_title) FILTER (WHERE work_title IS NOT NULL) AS work_title,
    max(media_id) FILTER (WHERE media_id IS NOT NULL) AS media_id,
    max(media_type) FILTER (WHERE media_type IS NOT NULL) AS media_type
    FROM character_favorites GROUP BY character_id`);
  const counts=new Map(rows.map(row=>[Number(row.character_id),Number(row.favorite_count)||0]));
  return{metricsSource:'aninexus',metric:'favorites',items:rankCharacterCatalog(counts,limit,rows)};
}

export async function getUserCharacterFavorites(userId){
  const {rows}=await q(`SELECT character_id,created_at,character_name AS name,native_name AS "nativeName",image_url AS image,work_title AS work,media_id AS "mediaId",media_type AS "mediaType"
    FROM character_favorites WHERE user_id=$1 ORDER BY created_at DESC LIMIT 500`,[userId]);
  return rows.map(row=>({characterId:Number(row.character_id),createdAt:row.created_at,name:row.name||'',nativeName:row.nativeName||'',image:row.image||'',work:row.work||'',mediaId:Number(row.mediaId)||null,mediaType:row.mediaType||'ANIME'}));
}

export function hydrateCharacterFavorites(items=[]){
  return items.map(item=>{
    const character=catalogById.get(Number(item.characterId))||normalizeCandidate(item,item.characterId);
    return character?{...character,createdAt:item.createdAt||null}:null;
  }).filter(Boolean);
}

export async function setCharacterFavorite(userId,characterId,favorite,metadata=null){
  const id=Number(characterId);
  const character=catalogById.get(id)||normalizeCandidate(metadata,id);
  if(favorite&&!character)return null;
  if(favorite)await q(`INSERT INTO character_favorites(user_id,character_id,character_name,native_name,image_url,work_title,media_id,media_type)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(user_id,character_id) DO UPDATE SET
      character_name=COALESCE(EXCLUDED.character_name,character_favorites.character_name),native_name=COALESCE(EXCLUDED.native_name,character_favorites.native_name),
      image_url=COALESCE(EXCLUDED.image_url,character_favorites.image_url),work_title=COALESCE(EXCLUDED.work_title,character_favorites.work_title),
      media_id=COALESCE(EXCLUDED.media_id,character_favorites.media_id),media_type=COALESCE(EXCLUDED.media_type,character_favorites.media_type)`,[userId,id,character.name,character.nativeName||null,character.image||null,character.work||null,character.mediaId||null,character.mediaType||'ANIME']);
  else await q('DELETE FROM character_favorites WHERE user_id=$1 AND character_id=$2',[userId,id]);
  const {rows}=await q('SELECT count(*)::int AS favorite_count FROM character_favorites WHERE character_id=$1',[id]);
  return{characterId:id,favorite:!!favorite,favoriteCount:Number(rows[0]?.favorite_count||0)};
}
