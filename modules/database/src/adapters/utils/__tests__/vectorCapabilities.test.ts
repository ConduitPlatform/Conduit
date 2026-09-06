import { describe, expect, it } from '@jest/globals';
import {
  mongoVectorCapabilities,
  postgresVectorCapabilities,
  sqlFallbackVectorCapabilities,
  unsupportedVectorCapabilities,
} from '../vectorCapabilities.js';

describe('vector capability contracts', () => {
  it('reports MongoDB storage even when search indexes cannot be probed', () => {
    expect(mongoVectorCapabilities({ hasSchema: false })).toMatchObject({
      supported: true,
      storage: true,
      indexing: false,
      search: false,
      provider: 'mongodb',
    });
    expect(
      mongoVectorCapabilities({
        hasSchema: true,
        searchIndexCommandsAvailable: false,
      }),
    ).toMatchObject({
      supported: true,
      storage: true,
      indexing: false,
      search: false,
      provider: 'mongodb',
    });
    expect(mongoVectorCapabilities({ hasSchema: true })).toEqual({
      supported: true,
      storage: true,
      indexing: true,
      search: true,
      provider: 'mongodb',
    });
  });

  it('keeps Postgres as a vector provider while distinguishing missing pgvector', () => {
    expect(postgresVectorCapabilities({ pgvectorAvailable: true })).toEqual({
      supported: true,
      storage: true,
      indexing: true,
      search: true,
      provider: 'postgres',
    });
    expect(
      postgresVectorCapabilities({
        pgvectorAvailable: false,
        error: 'type "vector" does not exist',
      }),
    ).toMatchObject({
      supported: true,
      storage: false,
      indexing: false,
      search: false,
      provider: 'postgres',
    });
  });

  it('describes JSON storage fallback for non-Postgres SQL without claiming search', () => {
    expect(sqlFallbackVectorCapabilities('mysql')).toEqual({
      supported: false,
      storage: true,
      indexing: false,
      search: false,
      provider: 'unsupported',
      reason:
        'mysql does not support Conduit vector search; Vector fields can be stored as JSON',
    });
    expect(sqlFallbackVectorCapabilities('sqlite')).toMatchObject({
      supported: false,
      storage: true,
      search: false,
      provider: 'unsupported',
    });
  });

  it('keeps unknown adapters unsupported with no storage fallback', () => {
    expect(unsupportedVectorCapabilities('custom')).toEqual({
      supported: false,
      storage: false,
      indexing: false,
      search: false,
      provider: 'unsupported',
      reason: 'custom does not support Conduit vector search',
    });
  });
});
