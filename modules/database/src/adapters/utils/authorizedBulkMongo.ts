import type { Indexable } from '@conduitplatform/grpc-sdk';
import type { Model } from 'mongoose';
import {
  AuthzBulkMaxTotalIdsError,
  getAuthzBulkChunkSize,
  getAuthzBulkMaxTotalIds,
} from './authorizedBulkConfig.js';

/**
 * Merge user filter with keyset `_id > lastId` for stable paging on the auth view.
 */
export function buildMongoKeysetFilter(
  userFilter: Indexable,
  lastId: unknown | null,
): Indexable {
  if (lastId === null || lastId === undefined) {
    return userFilter;
  }
  const cursor = { _id: { $gt: lastId } };
  if (!userFilter || Object.keys(userFilter).length === 0) {
    return cursor;
  }
  return { $and: [userFilter, cursor] };
}

/** Combine user filter with `_id: { $in: ids }` for base-collection bulk writes. */
export function mergeMongoBulkFilterWithIdIn(
  userFilter: Indexable,
  ids: unknown[],
): Indexable {
  const inClause = { _id: { $in: ids } };
  if (!userFilter || Object.keys(userFilter).length === 0) {
    return inClause;
  }
  return { $and: [userFilter, inClause] };
}

export type MongoIdBatchOptions = {
  chunkSize?: number;
  maxTotalIds?: number;
};

/**
 * Keyset-iterate `_id`s from a Mongoose auth view matching `userFilter`.
 */
export async function* iterateAuthorizedMongoIdBatches(
  viewModel: Model<any>,
  userFilter: Indexable,
  options: MongoIdBatchOptions = {},
): AsyncGenerator<unknown[]> {
  const chunkSize = options.chunkSize ?? getAuthzBulkChunkSize();
  const maxTotal = options.maxTotalIds ?? getAuthzBulkMaxTotalIds();
  let lastId: unknown | null = null;
  let total = 0;

  while (true) {
    const filter = buildMongoKeysetFilter(userFilter, lastId);
    const docs = await viewModel
      .find(filter)
      .select('_id')
      .sort({ _id: 1 })
      .limit(chunkSize)
      .lean()
      .exec();

    if (!docs?.length) break;

    const ids = docs.map((d: { _id: unknown }) => d._id);
    if (maxTotal > 0 && total + ids.length > maxTotal) {
      throw new AuthzBulkMaxTotalIdsError(maxTotal);
    }
    total += ids.length;
    yield ids;
    lastId = ids[ids.length - 1];
    if (ids.length < chunkSize) break;
  }
}
