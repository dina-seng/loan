import { prisma } from './db.js';

/** Append-only audit record for every important financial change. */
export async function audit(actorId, action, entityType, entityId, { before = null, after = null, metadata = null } = {}, client = prisma) {
  return client.auditLog.create({
    data: {
      actorId: actorId || null,
      action,
      entityType,
      entityId: entityId || null,
      before,
      after,
      metadata,
    },
  });
}

export function jsonSafe(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value, (_key, item) => (typeof item === 'bigint' ? item.toString() : item), 2));
}
