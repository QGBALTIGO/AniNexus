import { cacheRemember } from './cache.mjs';

const ENDPOINT=process.env.CATALOG_GRAPHQL_ENDPOINT||'https://graphql.anilist.co';
const TIMEOUT=Math.max(2500,Math.min(15000,Number(process.env.UPSTREAM_TIMEOUT_MS||9000)));
const TZ='America/Sao_Paulo';
const FIELDS='id title{romaji english native userPreferred}coverImage{extraLarge large}bannerImage averageScore popularity genres episodes format status seasonYear externalLinks{site url type icon color}';
const AWARDS=[
  'My Hero Academia Final Season',
  'Demon Slayer Infinity Castle',
  'One Piece',
  'Gachiakuta',
  'Lazarus',
  'Solo Leveling Season 2'
];

function seasonNow(){
  const d=new Date(),m=Number(new Intl.DateTimeFormat('en',{timeZone:TZ,month:'numeric'}).format(d)),year=Number(new Intl.DateTimeFormat('en',{timeZone:TZ,year:'numeric'}).format(d));
  return{year,season:m<=3?'WINTER':m<=6?'SPRING':m<=9?'SUMMER':'FALL'};
}
async function gql(query,variables={}){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),TIMEOUT);
  try{
    const r=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json',accept:'application/json','user-agent':'AniNexus-Home/3.8'},body:JSON.stringify({query,variables}),signal:ctl.signal,redirect:'error'});
    if(!r.ok)throw new Error(`AniList home upstream ${r.status}`);
    const type=String(r.headers.get('content-type')||'');if(!type.includes('application/json'))throw new Error('AniList home invalid content type');
    const j=await r.json();if(j.errors?.length)throw new Error(j.errors[0]?.message||'AniList home GraphQL error');return j.data;
  }finally{clearTimeout(timer)}
}

export async function getHomeFeed(){
  const s=seasonNow();
  return cacheRemember(`home-feed:${s.season}:${s.year}`,55,async()=>{
    const now=Math.floor(Date.now()/1000);
    const query=`query($season:MediaSeason,$year:Int,$now:Int){season:Page(page:1,perPage:22){media(type:ANIME,isAdult:false,season:$season,seasonYear:$year,sort:[POPULARITY_DESC]){${FIELDS}}}schedule:Page(page:1,perPage:8){airingSchedules(airingAt_greater:$now,sort:TIME){airingAt episode media{${FIELDS}}}}top:Page(page:1,perPage:10){media(type:ANIME,isAdult:false,sort:[SCORE_DESC]){${FIELDS}}}popular:Page(page:1,perPage:22){media(type:ANIME,isAdult:false,sort:[POPULARITY_DESC]){${FIELDS}}}soon:Page(page:1,perPage:22){media(type:ANIME,isAdult:false,status:NOT_YET_RELEASED,sort:[POPULARITY_DESC]){${FIELDS}}}reading:Page(page:1,perPage:18){media(type:MANGA,isAdult:false,sort:[POPULARITY_DESC]){id title{romaji english native userPreferred}coverImage{extraLarge large}averageScore genres format status}}}`;
    return gql(query,{season:s.season,year:s.year,now});
  },{staleTtl:900});
}

export async function getHomeAwards(){
  return cacheRemember('home-awards:2026',6*3600,async()=>{
    const f='id title{romaji english native userPreferred}coverImage{extraLarge large}averageScore';
    const aliases=AWARDS.map((term,i)=>`a${i}:Media(search:${JSON.stringify(term)},type:ANIME){${f}}`).join(' ');
    return gql(`query{${aliases}}`);
  },{staleTtl:7*86400});
}
