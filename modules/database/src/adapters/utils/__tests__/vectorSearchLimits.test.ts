import { describe, expect, it } from '@jest/globals';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  clampVectorSearchLimits,
  VECTOR_SEARCH_MAX_CANDIDATES,
  VECTOR_SEARCH_MAX_LIMIT,
} from '../vectorSearchLimits.js';

describe('vector search limits', () => {
  it('defaults limit and requires candidates to cover the requested limit', () => {
    expect(clampVectorSearchLimits({})).toEqual({ limit: 10, numCandidates: 100 });
    expect(clampVectorSearchLimits({ limit: 5 })).toEqual({
      limit: 5,
      numCandidates: 100,
    });
    expect(clampVectorSearchLimits({ limit: 25, numCandidates: 250 })).toEqual({
      limit: 25,
      numCandidates: 250,
    });
  });

  it('clamps oversized limit and candidate values', () => {
    expect(clampVectorSearchLimits({ limit: 50_000, numCandidates: 80_000 })).toEqual({
      limit: VECTOR_SEARCH_MAX_LIMIT,
      numCandidates: VECTOR_SEARCH_MAX_CANDIDATES,
    });
  });

  it('rejects non-positive values and candidates below the requested limit', () => {
    try {
      clampVectorSearchLimits({ limit: 0 });
      throw new Error('expected failure');
    } catch (err) {
      expect((err as GrpcError).code).toBe(status.INVALID_ARGUMENT);
    }
    try {
      clampVectorSearchLimits({ limit: 20, numCandidates: 5 });
      throw new Error('expected failure');
    } catch (err) {
      expect(err).toBeInstanceOf(GrpcError);
      expect((err as GrpcError).message).toMatch(/numCandidates must be at least/);
    }
  });
});
