// Provider failure is different from a valid, empty catalogue.
export async function fetchAnimeThemes(id, {endpoint='https://api.animethemes.moe', fetchImpl=fetch, timeout=8000}={}) {
  const mediaId=Number(id);
  if(!Number.isSafeInteger(mediaId)||mediaId<=0)throw new TypeError('Invalid media ID');
  const url=new URL(`${endpoint}/anime`);
  for(const [key,value] of Object.entries({'filter[has]':'resources','filter[site]':'AniList','filter[external_id]':String(mediaId),include:'animethemes.animethemeentries.videos,animethemes.song.artists','page[size]':'1'}))url.searchParams.set(key,value);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetchImpl(url,{headers:{accept:'application/json','user-agent':'AniNexus/3.8'},credentials:'omit',redirect:'error',signal:controller.signal});
    if(!response.ok)throw Object.assign(new Error('Theme provider unavailable'),{upstreamStatus:response.status});
    if(!String(response.headers.get('content-type')||'').includes('application/json'))throw new Error('Invalid theme content type');
    const payload=await response.json();
    if(!Array.isArray(payload?.anime))throw new Error('Invalid theme payload');
    return payload.anime[0]||null;
  }catch(cause){
    throw Object.assign(new Error('Theme catalogue temporarily unavailable',{cause}),{code:'THEMES_UNAVAILABLE',statusCode:503,upstreamStatus:cause.upstreamStatus});
  }finally{clearTimeout(timer)}
}
