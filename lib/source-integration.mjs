import crypto from 'node:crypto';
import { z } from 'zod';

const SOURCE_API_ORIGIN=String(process.env.SOURCE_API_ORIGIN||'https://bot-production-1980.up.railway.app').replace(/\/+$/,'');
if(!/^https:\/\//i.test(SOURCE_API_ORIGIN))throw new Error('SOURCE_API_ORIGIN must use HTTPS');
const encryptionMaterial=String(process.env.SOURCE_LINK_ENCRYPTION_KEY||process.env.IP_HASH_SALT||process.env.CLERK_SECRET_KEY||'');
const ENCRYPTION_KEY=encryptionMaterial?crypto.createHash('sha256').update('aninexus-source-link-v1:').update(encryptionMaterial).digest():null;

const favoriteSchema=z.object({
  id:z.number().int().positive(),
  name:z.string().min(1).max(180),
  work:z.string().max(240),
  image:z.string().url().nullable().optional(),
}).nullable();
const profileSchema=z.object({
  displayName:z.string().min(1).max(120),
  username:z.string().max(64).nullable().optional(),
  favorite:favoriteSchema.optional(),
  stats:z.object({
    level:z.number().int().min(1),xp:z.number().int().min(0),xpCurrent:z.number().int().min(0),xpNeeded:z.number().int().min(0),
    coins:z.number().int().min(0),uniqueCharacters:z.number().int().min(0),totalCharacters:z.number().int().min(0),totalAvailableCharacters:z.number().int().min(0),collectionPercent:z.number().min(0).max(100),
  }),
  public:z.boolean(),updatedAt:z.string().min(1).max(80),
});
const consumeSchema=z.object({
  linkId:z.string().uuid(),sourceSubject:z.string().regex(/^src_[a-f0-9]{64}$/),revokeToken:z.string().min(20).max(256),profile:profileSchema,
});

export class SourceIntegrationError extends Error{
  constructor(message,{status=502,code='SOURCE_UNAVAILABLE',cause}={}){super(message,{cause});this.name='SourceIntegrationError';this.status=status;this.code=code}
}

function encryptionKey(){if(!ENCRYPTION_KEY)throw new SourceIntegrationError('Integração Source sem chave de proteção.',{status:503,code:'SOURCE_LINK_KEY_MISSING'});return ENCRYPTION_KEY}
export function sealSourceRevokeToken(token){
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv),encrypted=Buffer.concat([cipher.update(String(token),'utf8'),cipher.final()]),tag=cipher.getAuthTag();
  return ['v1',iv.toString('base64url'),tag.toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function openSourceRevokeToken(value){
  try{const [version,ivRaw,tagRaw,dataRaw]=String(value||'').split('.');if(version!=='v1'||!ivRaw||!tagRaw||!dataRaw)throw new Error('bad envelope');const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(ivRaw,'base64url'));decipher.setAuthTag(Buffer.from(tagRaw,'base64url'));return Buffer.concat([decipher.update(Buffer.from(dataRaw,'base64url')),decipher.final()]).toString('utf8')}catch(error){if(error instanceof SourceIntegrationError)throw error;throw new SourceIntegrationError('Credencial do vínculo Source inválida.',{status:503,code:'SOURCE_LINK_SECRET_INVALID',cause:error})}
}

async function sourceRequest(path,{method='GET',body,timeoutMs=6000}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(SOURCE_API_ORIGIN+path,{method,redirect:'error',cache:'no-store',signal:controller.signal,headers:{accept:'application/json',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    let payload=null;try{payload=await response.json()}catch{}
    if(!response.ok){
      const detail=typeof payload?.detail==='string'?payload.detail:typeof payload?.error?.message==='string'?payload.error.message:null;
      throw new SourceIntegrationError(detail||'O Source não aceitou esta solicitação.',{status:response.status,code:payload?.error?.code||`SOURCE_HTTP_${response.status}`});
    }
    return payload;
  }catch(error){
    if(error instanceof SourceIntegrationError)throw error;
    const timedOut=error?.name==='AbortError';
    throw new SourceIntegrationError(timedOut?'O Source demorou para responder.':'Não foi possível falar com o Source.',{status:503,code:timedOut?'SOURCE_TIMEOUT':'SOURCE_UNAVAILABLE',cause:error});
  }finally{clearTimeout(timer)}
}

export async function consumeSourceLink(token){
  const payload=await sourceRequest('/api/integrations/aninexus/consume',{method:'POST',body:{token},timeoutMs:7000}),parsed=consumeSchema.safeParse(payload);
  if(!parsed.success)throw new SourceIntegrationError('Resposta de vínculo inválida.',{status:502,code:'SOURCE_INVALID_RESPONSE'});
  return parsed.data;
}
export async function fetchSourceProfile(linkId,{timeoutMs=5000}={}){
  const payload=await sourceRequest(`/api/integrations/aninexus/profile/${encodeURIComponent(linkId)}`,{timeoutMs}),parsed=profileSchema.safeParse(payload);
  if(!parsed.success)throw new SourceIntegrationError('Perfil Source inválido.',{status:502,code:'SOURCE_INVALID_RESPONSE'});
  return parsed.data;
}
export async function revokeSourceLink(linkId,revokeToken){
  await sourceRequest('/api/integrations/aninexus/revoke',{method:'POST',body:{linkId,revokeToken},timeoutMs:5000});
  return true;
}
export function publicSourceProfile(profile){const parsed=profileSchema.safeParse(profile);return parsed.success?parsed.data:null}
export { SOURCE_API_ORIGIN };
