import {collectEditorialStories as collectRaw,likelyPortuguese,languageScore} from './news-sources-v36.mjs';

function sourcePublishedAt(article){
  const times=(article?.sources||[])
    .map(source=>Date.parse(source?.publishedAt||''))
    .filter(Number.isFinite);
  if(times.length)return new Date(Math.max(...times)).toISOString();
  const own=Date.parse(article?.publishedAt||'');
  return Number.isFinite(own)?new Date(own).toISOString():new Date().toISOString();
}

export async function collectEditorialStories(options={}){
  const result=await collectRaw(options);
  const stories=(result?.stories||[]).map(article=>({
    ...article,
    publishedAt:sourcePublishedAt(article)
  })).sort((a,b)=>new Date(b.publishedAt)-new Date(a.publishedAt)||Number(b.qualityScore||0)-Number(a.qualityScore||0));
  return {...result,stories};
}

export {likelyPortuguese,languageScore};
