import { prisma } from './db.js';

/** Append-only audit record for every important financial change. */
export async function audit(
  actorId,
  action,
  entityType,
  entityId,
  { before = null, after = null, metadata = null, partnerId = null } = {},
  client = prisma,
) {
  return client.auditLog.create({
    data: {
      actorId: actorId || null,
      partnerId: partnerId || null,
      action,
      entityType,
      entityId: entityId || null,
      before,
      after,
      metadata,
    },
  });
}

/** Convert bigint, Decimal and Date values into JSON-safe values. */
export function jsonSafe(value) {
  if (value == null) return null;
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return item.toString();
    if (item && typeof item === 'object' && typeof item.toFixed === 'function') return item.toString();
    return item;
  }));
}
