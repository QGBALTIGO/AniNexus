// Operator-only handoff for post-event official evidence. The worker resolves
// the question from this immutable observation on its next cycle.
import fs from 'node:fs/promises';
import pg from 'pg';
import {evaluatePrediction} from '../lib/predictions.mjs';

const [id,file,flag]=process.argv.slice(2);
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')||!file||!['--check','--commit'].includes(flag||'')){
  console.error('Usage: node scripts/record-official-prediction-evidence.mjs <question-uuid> <evidence.json> --check|--commit');
  process.exitCode=2;
}else{
  const evidence=JSON.parse(await fs.readFile(file,'utf8'));
  const client=new pg.Client({connectionString:process.env.DATABASE_URL});
  await client.connect();
  try{
    await client.query('BEGIN');
    const row=(await client.query('SELECT * FROM prediction_questions WHERE id=$1 FOR UPDATE',[id])).rows[0];
    if(!row||row.type!=='OFFICIAL_EVENT'||!['OPEN','LOCKED'].includes(row.status))throw new Error('OFFICIAL_QUESTION_NOT_OPEN');
    const now=new Date((await client.query('SELECT clock_timestamp() prediction_now')).rows[0].prediction_now);
    const result=evaluatePrediction(row,evidence,now);
    if(result.status!=='RESOLVED')throw new Error(`EVIDENCE_REJECTED:${result.reason}`);
    const existing=(await client.query('SELECT name FROM prediction_job_state WHERE name=$1',[`official-observation:${id}`])).rows[0];
    if(existing)throw new Error('EVIDENCE_ALREADY_RECORDED');
    if(flag==='--commit')await client.query(`INSERT INTO prediction_job_state(name,next_run_at,details) VALUES($1,$2,$3::jsonb)`,
      [`official-observation:${id}`,now,JSON.stringify({observation:result.evidence})]);
    await client.query(flag==='--commit'?'COMMIT':'ROLLBACK');
    console.log(JSON.stringify({questionId:id,decision:result.result,recorded:flag==='--commit'}));
  }catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(error.message);process.exitCode=1}
  finally{await client.end()}
}
