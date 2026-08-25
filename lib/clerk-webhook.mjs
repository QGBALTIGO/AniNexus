import crypto from 'node:crypto';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { q } from './db.mjs';
import { getClerkClient, syncClerkUser } from './auth.mjs';

function webhookRequest(request) {
  const headers = new Headers();
  for (const [name, raw] of Object.entries(request.headers || {})) {
    if (raw == null) continue;
    headers.set(name, Array.isArray(raw) ? raw.join(', ') : String(raw));
  }
  const host = String(request.headers.host || 'localhost');
  const protocol = String(request.protocol || 'https').replace(/:$/, '');
  const body = Buffer.isBuffer(request.rawBody) ? request.rawBody : Buffer.from(String(request.rawBody || ''), 'utf8');
  return new Request(new URL(String(request.raw?.url || request.url || '/api/webhooks/clerk'), `${protocol}://${host}`), {
    method: 'POST',
    headers,
    body,
  });
}

export async function processClerkWebhook(request) {
  const signingSecret = String(process.env.CLERK_WEBHOOK_SIGNING_SECRET || '');
  if (!signingSecret.startsWith('whsec_')) throw new Error('CLERK_WEBHOOK_SIGNING_SECRET is not configured');
  if (!request.rawBody) throw new Error('Raw webhook body is unavailable');

  const event = await verifyWebhook(webhookRequest(request), { signingSecret });
  const eventId = String(event.id || request.headers['svix-id'] || '');
  if (!eventId || eventId.length > 180) throw new Error('Invalid Clerk webhook id');
  const payloadHash = crypto.createHash('sha256').update(request.rawBody).digest('hex');
  const inserted = await q(`INSERT INTO clerk_webhook_events(event_id,event_type,payload_hash)
    VALUES($1,$2,$3) ON CONFLICT(event_id) DO NOTHING RETURNING event_id`, [eventId, String(event.type || 'unknown').slice(0, 120), payloadHash]);
  if (!inserted.rows[0]) return { ok: true, duplicate: true };

  try {
    if (event.type === 'user.created' || event.type === 'user.updated') {
      const userId = String(event.data?.id || '');
      if (!userId) throw new Error('Clerk webhook user id is missing');
      await syncClerkUser(await getClerkClient().users.getUser(userId));
    } else if (event.type === 'user.deleted' && event.data?.id) {
      await q('DELETE FROM users WHERE clerk_user_id=$1', [String(event.data.id)]);
    }
    await q('UPDATE clerk_webhook_events SET processed_at=now() WHERE event_id=$1', [eventId]);
    return { ok: true };
  } catch (error) {
    await q('DELETE FROM clerk_webhook_events WHERE event_id=$1', [eventId]).catch(() => {});
    throw error;
  }
}
