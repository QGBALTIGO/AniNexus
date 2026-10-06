import pg from 'pg';

// Metadata has a small, read-only pool and cannot consume the application's query pool.
export function createPublicDocumentData(connectionString){
  const pool=new pg.Pool({connectionString,max:2,min:0,idleTimeoutMillis:10_000,
    connectionTimeoutMillis:400,statement_timeout:500,query_timeout:750,
    options:'-c default_transaction_read_only=on',application_name:'aninexus-public-document',allowExitOnIdle:true});
  pool.on('error',()=>console.warn('[public-document] metadata connection unavailable'));
  return {query:(text,values)=>pool.query(text,values),close:()=>pool.end()};
}
