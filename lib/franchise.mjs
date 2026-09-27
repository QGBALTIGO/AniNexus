const RELATIONS = new Set(['PREQUEL','SEQUEL','PARENT','SIDE_STORY','SPIN_OFF','ALTERNATIVE','SUMMARY','COMPILATION','ADAPTATION','SOURCE']);
const idOf = value => Number.isSafeInteger(Number(value)) && Number(value)>0 ? Number(value) : null;
const typeOf = value => value==='MANGA'?'MANGA':'ANIME';
const keyOf = m => `${typeOf(m.mediaType||m.type)}:${idOf(m.id)}`;
const titleOf = m => typeof m.title==='string'?m.title:m.title?.userPreferred||m.title?.romaji||m.title?.english||'';
function nodeOf(m) {
  if(!idOf(m?.id)||!titleOf(m)||m.isAdult===true)return null;
  const cover=m.cover||m.coverImage?.large||m.coverImage?.extraLarge||'';
  return {key:keyOf(m),id:idOf(m.id),mediaType:typeOf(m.mediaType||m.type),title:titleOf(m).slice(0,300),cover:/^https:\/\//i.test(cover)?cover.slice(0,2000):null,
    format:String(m.format||''),status:String(m.status||''),startDate:m.startDate||null,year:Number(m.startDate?.year||m.seasonYear)||null};
}
function releaseOrder(a,b) {
  const key=n=>n.year?`${String(n.year).padStart(4,'0')}-${String(n.startDate?.month||99).padStart(2,'0')}-${String(n.startDate?.day||99).padStart(2,'0')}`:'9999';
  return key(a).localeCompare(key(b))||a.key.localeCompare(b.key);
}
export function orderFranchise(nodes,edges,root) {
  const byKey=new Map(nodes.map(n=>[n.key,n])), connected=new Set([root]);
  const orderedEdges=edges.filter(e=>['PREQUEL','SEQUEL'].includes(e.relation)&&byKey.get(e.from)?.mediaType===byKey.get(e.to)?.mediaType)
    .map(e=>e.relation==='PREQUEL'?{from:e.to,to:e.from}:{from:e.from,to:e.to});
  for(let pass=0;pass<nodes.length;pass++){let changed=false;for(const e of orderedEdges)if(connected.has(e.from)||connected.has(e.to)){if(!connected.has(e.from)||!connected.has(e.to))changed=true;connected.add(e.from);connected.add(e.to)}if(!changed)break;}
  const sequence=nodes.filter(n=>connected.has(n.key)), incoming=new Map(sequence.map(n=>[n.key,new Set()]));
  for(const e of orderedEdges)if(incoming.has(e.from)&&incoming.has(e.to)&&e.from!==e.to)incoming.get(e.to).add(e.from);
  const result=[],remaining=new Set(sequence.map(n=>n.key));
  while(remaining.size){const ready=sequence.filter(n=>remaining.has(n.key)&&[...incoming.get(n.key)].every(p=>!remaining.has(p))).sort(releaseOrder);if(!ready.length)break;for(const n of ready){result.push(n.key);remaining.delete(n.key)}}
  return {sequence:remaining.size?sequence.sort(releaseOrder).map(n=>n.key):result,cycle:remaining.size>0,release:[...nodes].sort(releaseOrder).map(n=>n.key)};
}
export async function collectFranchise(root,loadCached,{maxNodes=60,maxDepth=4}={}) {
  const seed=nodeOf(root);if(!seed)return null;
  const nodes=new Map([[seed.key,seed]]),payloads=new Map([[seed.key,root]]),edges=new Map(),visited=new Set();let partial=false;
  let frontier=[seed.key];
  for(let depth=0;frontier.length&&depth<=maxDepth;depth++){
    if(depth){const loaded=await loadCached(frontier.map(k=>nodes.get(k)));for(const m of loaded){const node=nodeOf(m);if(node&&nodes.has(node.key)){nodes.set(node.key,node);payloads.set(node.key,m)}}}
    const next=new Set();
    for(const key of frontier){if(visited.has(key))continue;visited.add(key);const source=payloads.get(key);
      const relations=source?.relations?.edges||source?.relations;
      if(!Array.isArray(relations)){partial=true;continue;}
      for(const edge of relations.slice(0,60)){
        const relation=String(edge.relationType||'');if(!RELATIONS.has(relation))continue;
        const target=edge.media||edge.node,node=nodeOf(target);if(!node||node.key===key)continue;
        if(!nodes.has(node.key)){if(nodes.size>=maxNodes){partial=true;continue;}nodes.set(node.key,node);payloads.set(node.key,target);}
        edges.set(`${key}|${relation}|${node.key}`,{from:key,to:node.key,relation});
        if(!visited.has(node.key)){if(depth===maxDepth)partial=true;else next.add(node.key);}
      }
      if(relations.length>60)partial=true;
    }
    frontier=[...next];
  }
  const items=[...nodes.values()],links=[...edges.values()];
  return {root:seed.key,nodes:items,edges:links,order:orderFranchise(items,links,seed.key),partial,
    scope:'Relações catalogadas; a ordem por sequência não substitui uma curadoria cronológica.',chronological:null};
}
const ids=value=>{if(value==null||value==='')return[];if(typeof value!=='string'||!/^[0-9]+(?:,[0-9]+)*$/.test(value))return null;const result=[...new Set(value.split(',').map(idOf))];return result.length<=60&&result.every(Boolean)?result:null;};
export const franchiseCacheSql=`SELECT media_id,media_type,payload FROM media_cache WHERE (media_type='ANIME' AND media_id=ANY($1::bigint[])) OR (media_type='MANGA' AND media_id=ANY($2::bigint[]))`;
export const franchiseProgressSql=`SELECT media_id,'ANIME'::text media_type,status,progress FROM user_anime WHERE user_id=$1 AND media_id=ANY($2::bigint[])
  UNION ALL SELECT media_id,'MANGA'::text,status,progress FROM user_manga WHERE user_id=$1 AND media_id=ANY($3::bigint[])`;
export function registerFranchise(app,{q,getAnime,getManga,cacheRemember,requireUser,publicRate,privateReadRate}) {
  const load=async nodes=>{const {rows}=await q(franchiseCacheSql,[nodes.filter(n=>n.mediaType==='ANIME').map(n=>n.id),nodes.filter(n=>n.mediaType==='MANGA').map(n=>n.id)]);return rows.map(r=>({...r.payload,id:Number(r.media_id),mediaType:r.media_type}));};
  for(const type of ['ANIME','MANGA'])app.get(`/api/${type.toLowerCase()}/:id/franchise`,publicRate,async(req,reply)=>{
    const id=idOf(req.params.id);if(!id)return reply.code(400).send({error:'INVALID_ID'});
    const result=await cacheRemember(`franchise:v1:${type}:${id}`,600,async()=>{const cached=(await load([{id,mediaType:type}]))[0];const root=Array.isArray(cached?.relations)?cached:await(type==='MANGA'?getManga:getAnime)(id);return collectFranchise({...root,id,mediaType:type},load)});
    if(!result)return reply.code(404).send({error:'NOT_FOUND'});return result;
  });
  app.get('/api/me/franchise-progress',privateReadRate,async(req,reply)=>{
    const user=await requireUser(req,reply);if(!user)return;
    const anime=ids(req.query?.anime),manga=ids(req.query?.manga);
    if(!anime||!manga||anime.length+manga.length>60)return reply.code(400).send({error:'INVALID_IDS'});
    reply.header('Cache-Control','private, no-store');
    const {rows}=await q(franchiseProgressSql,[user.id,anime,manga]);return{items:rows};
  });
}
