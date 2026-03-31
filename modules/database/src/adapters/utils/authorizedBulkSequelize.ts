import type { ModelStatic, WhereOptions } from 'sequelize';
import {
  AuthzBulkMaxTotalIdsError,
  getAuthzBulkChunkSize,
  getAuthzBulkMaxTotalIds,
} from './authorizedBulkConfig.js';

export type SequelizeIdBatchOptions = {
  chunkSize?: number;
  maxTotalIds?: number;
};

/**
 * Offset-page through authorized view primary keys (SQL). Prefer keyset later if needed.
 */
export async function* iterateAuthorizedSequelizeIdBatches(
  viewModel: ModelStatic<any>,
  where: WhereOptions<any>,
  primaryKeyAttribute: string,
  chunkSizeInput?: number,
  maxTotalInput?: number,
): AsyncGenerator<unknown[]> {
  const chunkSize = chunkSizeInput ?? getAuthzBulkChunkSize();
  const maxTotal = maxTotalInput ?? getAuthzBulkMaxTotalIds();
  let offset = 0;
  let total = 0;

  while (true) {
    const docs = await viewModel.findAll({
      where,
      attributes: [primaryKeyAttribute],
      limit: chunkSize,
      offset,
      order: [[primaryKeyAttribute, 'ASC']],
    });
    if (!docs.length) break;

    const ids = docs.map(d => d.get(primaryKeyAttribute));
    if (maxTotal > 0 && total + ids.length > maxTotal) {
      throw new AuthzBulkMaxTotalIdsError(maxTotal);
    }
    total += ids.length;
    yield ids;
    if (docs.length < chunkSize) break;
    offset += chunkSize;
  }
}
