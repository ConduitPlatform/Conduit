import { describe, expect, it } from '@jest/globals';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { renderPostgresVectorWhere } from '../vectorSearchWhere.js';

const renderer = {
  quoteIdentifier: (identifier: string) => `"${identifier.replace(/"/g, '""')}"`,
  escape: (value: unknown) =>
    typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value),
};

describe('postgres vector search where rendering', () => {
  it('renders supported comparison and membership filters', () => {
    expect(
      renderPostgresVectorWhere(
        {
          tenantId: 'org-1',
          status: { $in: ['active', 'draft'] },
          score: { $gte: 1, $lt: 10 },
        },
        renderer,
      ),
    ).toBe(
      ` WHERE "tenantId" = 'org-1' AND "status" IN ('active', 'draft') AND ("score" >= 1 AND "score" < 10)`,
    );
  });

  it('returns no rows for empty $in instead of dropping the predicate', () => {
    expect(renderPostgresVectorWhere({ status: { $in: [] } }, renderer)).toBe(
      ' WHERE FALSE',
    );
  });

  it('fails instead of silently dropping unsupported operators', () => {
    try {
      renderPostgresVectorWhere({ tenantId: { $regex: '^org' } }, renderer);
      throw new Error('expected failure');
    } catch (err) {
      expect(err).toBeInstanceOf(GrpcError);
      expect((err as GrpcError).code).toBe(status.INVALID_ARGUMENT);
    }
  });
});
