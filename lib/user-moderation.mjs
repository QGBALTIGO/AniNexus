// Lock actor and target in a stable order so a concurrent role change cannot
// authorize a later administrative mutation with the previous role.
export async function lockModerationUsers(client, actor, targetId) {
  const ids = [...new Set([String(actor.id).toLowerCase(), String(targetId).toLowerCase()])];
  const { rows } = await client.query('SELECT * FROM users WHERE id=ANY($1::uuid[]) AND deleted_at IS NULL ORDER BY id FOR UPDATE', [ids]);
  const currentActor = rows.find(row => row.id === ids[0]);
  if (!currentActor || currentActor.status !== 'active' || !['moderator', 'admin'].includes(currentActor.role)) return { forbidden: true };
  const target = rows.find(row => row.id === String(targetId).toLowerCase());
  return target ? { actor: currentActor, target } : null;
}

export function moderationDecision(actor, target, changes) {
  if (String(actor.id).toLowerCase() === String(target.id).toLowerCase() &&
      ((changes.status && changes.status !== 'active') || (changes.role && changes.role !== actor.role))) return 'self';
  if (actor.role !== 'admin' && (target.role !== 'user' || changes.role !== undefined)) return 'forbidden';
  return null;
}
