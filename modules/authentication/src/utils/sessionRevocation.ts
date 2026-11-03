import { Query } from '@conduitplatform/grpc-sdk';
import { AccessToken, RefreshToken } from '../models/index.js';
import { revokeSessions } from './sessionServices.js';

const BATCH_SIZE = 500;

/**
 * Deletes the refresh tokens matching the query batch by batch and revokes each batch's
 * sessions (refresh row id = session id) in the registry. The ids are read before the
 * delete (the matching rows are deleted by id, so exactly the revoked sessions go).
 * Registry failures are logged by `revokeSessions`, never thrown.
 */
async function deleteRefreshTokensAndRevoke(
  query: Query<RefreshToken>,
  context: string,
): Promise<number> {
  let deleted = 0;
  for (;;) {
    const rows = await RefreshToken.getInstance().findMany(query, {
      select: '_id',
      limit: BATCH_SIZE,
      readPreference: 'primary',
    });
    if (rows.length === 0) break;
    const ids = rows.map(row => String(row._id));
    const result = await RefreshToken.getInstance().deleteMany({
      _id: { $in: ids },
    } as Query<RefreshToken>);
    await revokeSessions(ids, context);
    deleted += ids.length;
    // a delete that removed nothing would make this loop forever
    const count = (result as { deletedCount?: unknown } | undefined)?.deletedCount;
    if (rows.length < BATCH_SIZE || count === 0) break;
  }
  return deleted;
}

/**
 * The user ids of a purely user-scoped sweep (`{ user }` or `{ user: { $in } }`); empty
 * for sweeps narrowed by realm, client or anything else.
 */
function userScopedIds(query: Record<string, unknown>): string[] {
  const keys = Object.keys(query);
  if (keys.length !== 1 || keys[0] !== 'user') return [];
  const user = query.user as unknown;
  if (typeof user === 'string') return [user];
  const list = (user as { $in?: unknown } | null)?.$in;
  return Array.isArray(list) ? list.map(String) : [];
}

/**
 * A revocation sweep: every access token (session mode) and refresh token matching the
 * query is deleted and the affected sessions are revoked in the registry.
 *
 * jwt sessions without a refresh row (uuid session ids) have no row to be found by: a
 * user-scoped sweep reaches them through the per-user index in Redis, sweeps scoped by
 * realm or client cannot (they end with their access token).
 */
export async function deleteSessionTokens(
  query: Query<AccessToken>,
  context = 'sweep',
): Promise<void> {
  await Promise.all([
    AccessToken.getInstance().deleteMany(query),
    deleteRefreshTokensAndRevoke(query as Query<RefreshToken>, context),
  ]);
  const userIds = userScopedIds(query as Record<string, unknown>);
  if (userIds.length > 0) await revokeSessions([], context, { userIds });
}

/**
 * Mode switch: the access and refresh token rows created before `before` go, in batches,
 * and their sessions are revoked; sessions created after the switch (logins that raced
 * the purge) are kept. Returns the number of sessions (refresh rows) removed.
 */
export async function purgeAllSessionTokens(
  context = 'mode switch',
  before: Date = new Date(),
): Promise<number> {
  const query = {
    $or: [{ createdAt: { $lt: before } }, { createdAt: { $exists: false } }],
  };
  const sessions = await deleteRefreshTokensAndRevoke(
    query as unknown as Query<RefreshToken>,
    context,
  );
  for (;;) {
    const rows = await AccessToken.getInstance().findMany(
      query as unknown as Query<AccessToken>,
      { select: '_id', limit: BATCH_SIZE, readPreference: 'primary' },
    );
    if (rows.length === 0) break;
    const result = await AccessToken.getInstance().deleteMany({
      _id: { $in: rows.map(row => String(row._id)) },
    } as Query<AccessToken>);
    const count = (result as { deletedCount?: unknown } | undefined)?.deletedCount;
    if (rows.length < BATCH_SIZE || count === 0) break;
  }
  return sessions;
}
