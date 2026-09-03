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
const catalogIds=catalog.map(item=>item.id);

if(!catalog.length||catalog.some(item=>!Number.isSafeInteger(item.id)||item.id<=0||!item.name||!item.image)||catalogById.size!==catalog.length){
  throw new Error('Invalid character ranking catalog');
}

export function hasCharacter(characterId){return catalogById.has(Number(characterId))}

export function rankCharacterCatalog(counts=new Map(),limit=10){
  const normalized=counts instanceof Map?counts:new Map(Object.entries(counts||{}).map(([id,count])=>[Number(id),Number(count)||0]));
  return catalog
    .map(item=>({...item,favoriteCount:Math.max(0,Number(normalized.get(item.id))||0)}))
    .sort((a,b)=>b.favoriteCount-a.favoriteCount||a.seedOrder-b.seedOrder||a.id-b.id)
    .slice(0,Math.max(1,Math.min(catalog.length,Number(limit)||10)))
    .map((item,index)=>({...item,rank:index+1}));
}

export async function getCharacterRanking(limit=10){
  const {rows}=await q('SELECT character_id,count(*)::int AS favorite_count FROM character_favorites WHERE character_id=ANY($1::bigint[]) GROUP BY character_id',[catalogIds]);
  const counts=new Map(rows.map(row=>[Number(row.character_id),Number(row.favorite_count)||0]));
  return{metricsSource:'aninexus',metric:'favorites',items:rankCharacterCatalog(counts,limit)};
}

export async function getUserCharacterFavorites(userId){
  const {rows}=await q('SELECT character_id,created_at FROM character_favorites WHERE user_id=$1 ORDER BY created_at DESC LIMIT 500',[userId]);
  return rows.map(row=>({characterId:Number(row.character_id),createdAt:row.created_at}));
}

export async function setCharacterFavorite(userId,characterId,favorite){
  const id=Number(characterId);
  if(!hasCharacter(id))return null;
  if(favorite)await q('INSERT INTO character_favorites(user_id,character_id) VALUES($1,$2) ON CONFLICT(user_id,character_id) DO NOTHING',[userId,id]);
  else await q('DELETE FROM character_favorites WHERE user_id=$1 AND character_id=$2',[userId,id]);
  const {rows}=await q('SELECT count(*)::int AS favorite_count FROM character_favorites WHERE character_id=$1',[id]);
  return{characterId:id,favorite:!!favorite,favoriteCount:Number(rows[0]?.favorite_count||0)};
}
