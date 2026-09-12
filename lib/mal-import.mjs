import { load } from 'cheerio';

const SITE = 'https://myanimelist.net';
const fail = code => Object.assign(new Error(code), { code });
const integer = value => Math.min(100000, Math.max(0, Math.floor(Number(value) || 0)));
const https = value => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };

export function normalizeMalEntries(rows, mediaType) {
  const prefix = mediaType === 'MANGA' ? 'manga' : 'anime', unique = new Map();
  for (const row of rows) {
    const idMal = Number(row?.[`${prefix}_id`]);
    if (!Number.isSafeInteger(idMal) || idMal <= 0 || ![1, 2, 3, 4, 6].includes(Number(row.status))) throw fail('MAL_INVALID_RESPONSE');
    unique.set(idMal, {
      idMal, mediaType,
      status: ({1:'CURRENT',2:'COMPLETED',3:'PAUSED',4:'DROPPED',6:'PLANNING'})[row.status],
      score: Number(row.score) > 0 ? Math.min(10, Number(row.score)) : null,
      progress: integer(row[mediaType === 'MANGA' ? 'num_read_chapters' : 'num_watched_episodes']),
      volumeProgress: mediaType === 'MANGA' ? integer(row.num_read_volumes) : 0,
      updatedAt: Number(row.updated_at) > 0 ? Math.floor(Number(row.updated_at)) : Math.floor(Date.now()/1000),
      title: String(row[`${prefix}_title`] || '').slice(0,300),
      cover: https(row[`${prefix}_image_path`]),
    });
  }
  return [...unique.values()];
}

export async function fetchMalEntries({username, types=['ANIME','MANGA'], fetchImpl=fetch, timeoutMs=60000}) {
  if (!/^[A-Za-z0-9_-]{2,30}$/.test(username)) throw fail('INVALID_IMPORT');
  const signal=AbortSignal.timeout(Math.min(90000,Math.max(1000,timeoutMs)));
  const request=async(path,json=false)=>{
    let response;
    try { response=await fetchImpl(SITE+path,{headers:{accept:json?'application/json':'text/html','user-agent':'AniNexus/3.8'},credentials:'omit',redirect:'error',signal}); }
    catch { throw fail('MAL_UNAVAILABLE'); }
    if(response.status===404)throw fail('MAL_USER_NOT_FOUND');
    if(response.status===401||response.status===403)throw fail('MAL_LIST_UNAVAILABLE');
    if(!response.ok)throw fail('MAL_UNAVAILABLE');
    if(Number(response.headers.get('content-length'))>8*1024*1024)throw fail('MAL_INVALID_RESPONSE');
    const reader=response.body.getReader();let size=0;const chunks=[];
    try { for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8*1024*1024){await reader.cancel();throw fail('MAL_INVALID_RESPONSE')}chunks.push(Buffer.from(value))} }
    finally { reader.releaseLock(); }
    const text=Buffer.concat(chunks).toString('utf8');
    if(!json)return text;
    try { const data=JSON.parse(text);if(!Array.isArray(data))throw Error();return data; } catch { throw fail('MAL_LIST_UNAVAILABLE'); }
  };
  const $=load(await request(`/profile/${encodeURIComponent(username)}`));
  const title=String($('meta[property="og:title"]').attr('content')||$('title').text()).trim();
  const canonical=title.match(/^(.+?)'s Profile - MyAnimeList\.net$/)?.[1];
  if(!canonical||canonical.toLowerCase()!==username.toLowerCase())throw fail('MAL_USER_NOT_FOUND');
  const entries=[];
  for(const type of [...new Set(types)].filter(type=>['ANIME','MANGA'].includes(type))){
    const seen=new Set();let offset=0;
    for(;;){
      const rows=await request(`/${type==='MANGA'?'mangalist':'animelist'}/${encodeURIComponent(canonical)}/load.json?offset=${offset}&status=7`,true);
      if(!rows.length)break;
      const normalized=normalizeMalEntries(rows,type);
      if(normalized.some(row=>seen.has(row.idMal)))throw fail('MAL_INVALID_RESPONSE');
      for(const entry of normalized){seen.add(entry.idMal);entries.push(entry)}
      if(entries.length>5000)throw fail('IMPORT_TOO_LARGE');
      if(rows.length<300)break;
      offset+=rows.length;
    }
  }
  return {account:{username:canonical,url:`${SITE}/profile/${encodeURIComponent(canonical)}`},entries};
}

export async function mapMalEntries(entries,resolve,{deadlineAt=Infinity}={}) {
  const matched=[],unmatched=[];
  for(const type of ['ANIME','MANGA']){
    const rows=entries.filter(row=>row.mediaType===type);
    for(let offset=0;offset<rows.length;offset+=50){
      if(Date.now()>=deadlineAt)throw fail('MAL_UNAVAILABLE');
      const batch=rows.slice(offset,offset+50),media=await resolve(batch.map(row=>row.idMal),type);
      if(Date.now()>=deadlineAt)throw fail('MAL_UNAVAILABLE');
      const byId=new Map(media.filter(item=>item.mediaType===type&&Number.isSafeInteger(Number(item.id))&&Number(item.id)>0).map(item=>[Number(item.idMal),item]));
      for(const row of batch){const item=byId.get(row.idMal);if(!item){unmatched.push({idMal:row.idMal,mediaType:type,title:row.title});continue}
        matched.push({...row,mediaId:Number(item.id),media:{...item,title:item.title||row.title,cover:item.cover||row.cover}});
      }
    }
  }
  return {entries:matched,unmatched};
}
