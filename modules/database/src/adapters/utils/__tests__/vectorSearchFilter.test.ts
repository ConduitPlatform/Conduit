import { describe, expect, it } from '@jest/globals';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { validateVectorSearchFilter } from '../vectorSearchFilter.js';

function expectInvalid(run: () => unknown) {
  try {
    run();
    throw new Error('expected INVALID_ARGUMENT');
  } catch (err) {
    expect(err).toBeInstanceOf(GrpcError);
    expect((err as GrpcError).code).toBe(status.INVALID_ARGUMENT);
  }
}

describe('vector search filter validation', () => {
  const mongoFields = ['_id', 'tenantId', 'status'];
  const postgresFields = ['_id', 'tenantId', 'status', 'score'];

  it('accepts Atlas-legal indexed Mongo prefilters', () => {
    const validated = validateVectorSearchFilter(
      {
        tenantId: 'org-1',
        status: { $in: ['active', 'draft'] },
        $or: [{ score: { $gte: 1 } }, { score: { $lte: 0 } }],
      },
      { provider: 'mongodb', allowedFilterFields: [...mongoFields, 'score'] },
    );
    expect(validated.emptyResult).toBe(false);
    expect(validated.filter.tenantId).toBe('org-1');
  });

  it('rejects Mongo filters that are not declared indexed filter fields', () => {
    expectInvalid(() =>
      validateVectorSearchFilter(
        { authorId: 'user-1' },
        { provider: 'mongodb', allowedFilterFields: mongoFields },
      ),
    );
  });

  it('rejects Mongo filters when no indexed filter fields are declared', () => {
    expectInvalid(() =>
      validateVectorSearchFilter({ tenantId: 'org-1' }, { provider: 'mongodb' }),
    );
  });

  it('rejects unsupported Mongo operators that Atlas vector search cannot prefilter', () => {
    expectInvalid(() =>
      validateVectorSearchFilter(
        { tenantId: { $regex: '^org' } },
        { provider: 'mongodb', allowedFilterFields: mongoFields },
      ),
    );
    expectInvalid(() =>
      validateVectorSearchFilter(
        { tenantId: { $exists: true } },
        { provider: 'mongodb', allowedFilterFields: mongoFields },
      ),
    );
    expectInvalid(() =>
      validateVectorSearchFilter(
        { tenantId: { $elemMatch: { a: 1 } } },
        { provider: 'mongodb', allowedFilterFields: mongoFields },
      ),
    );
  });

  it('never silently drops unsupported Postgres filters', () => {
    expectInvalid(() =>
      validateVectorSearchFilter(
        { tenantId: { $regex: '^org' } },
        { provider: 'postgres', allowedFilterFields: postgresFields },
      ),
    );
    expectInvalid(() =>
      validateVectorSearchFilter(
        { unknownColumn: 'x' },
        { provider: 'postgres', allowedFilterFields: postgresFields },
      ),
    );
  });

  it('treats empty $in as a no-row filter', () => {
    expect(
      validateVectorSearchFilter(
        { status: { $in: [] } },
        { provider: 'mongodb', allowedFilterFields: mongoFields },
      ).emptyResult,
    ).toBe(true);
    expect(
      validateVectorSearchFilter(
        { $and: [{ tenantId: 'org-1' }, { status: { $in: [] } }] },
        { provider: 'postgres', allowedFilterFields: postgresFields },
      ).emptyResult,
    ).toBe(true);
    expect(
      validateVectorSearchFilter(
        { $or: [{ status: { $in: [] } }, { tenantId: { $in: [] } }] },
        { provider: 'postgres', allowedFilterFields: postgresFields },
      ).emptyResult,
    ).toBe(true);
  });

  it('does not treat negated or $nor empty $in as a no-row filter', () => {
    expect(
      validateVectorSearchFilter(
        { status: { $not: { $in: [] } } },
        { provider: 'mongodb', allowedFilterFields: mongoFields },
      ).emptyResult,
    ).toBe(false);
    expect(
      validateVectorSearchFilter(
        { $nor: [{ status: { $in: [] } }] },
        { provider: 'postgres', allowedFilterFields: postgresFields },
      ).emptyResult,
    ).toBe(false);
  });
});
