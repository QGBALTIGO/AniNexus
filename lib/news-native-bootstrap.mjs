import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ingestNewsItems } from './news-native-ingest.mjs';
import { expireOldNews } from './native-news.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(__dirname,'..');

export async function bootstrapNativeNews(){
  await expireOldNews().catch(()=>{});
  try{
    const raw=await fs.readFile(path.join(root,'data','news.json'),'utf8');
    const feed=JSON.parse(raw);
    const items=Array.isArray(feed?.items)?feed.items:[];
    if(items.length)return ingestNewsItems(items.slice(0,60));
  }catch(err){console.error('[native-news-bootstrap]',err?.message||err)}
  return 0;
}
