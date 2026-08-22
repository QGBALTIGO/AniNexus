import { expireOldNews } from './native-news.mjs';

const interval=Math.max(60_000,Number(process.env.NEWS_RETENTION_SWEEP_MS||900_000));

async function sweep(){
  try{await expireOldNews();console.log('[news-retention] sweep ok')}catch(err){console.error('[news-retention]',err?.message||err)}
}

await sweep();
setInterval(sweep,interval).unref?.();
