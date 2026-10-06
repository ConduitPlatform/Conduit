import { describe, expect, it } from '@jest/globals';
import { VectorSimilarity } from '@conduitplatform/grpc-sdk';
import { normalizeVectorSearchScore, toVectorSearchResult } from '../vectorScore.js';

describe('vector search score contract', () => {
  it('keeps Mongo cosine scores as higher-is-better without claiming a raw distance', () => {
    const normalized = normalizeVectorSearchScore({
      provider: 'mongodb',
      metric: VectorSimilarity.Cosine,
      raw: 0.91,
    });
    expect(normalized).toEqual({
      score: 0.91,
      metric: VectorSimilarity.Cosine,
      provider: 'mongodb',
      comparable: true,
    });
    expect(toVectorSearchResult({ _id: 'a' }, normalized)).toEqual({
      document: { _id: 'a' },
      score: 0.91,
      metric: VectorSimilarity.Cosine,
      provider: 'mongodb',
    });
  });

  it('converts Postgres cosine distance with 1 - distance', () => {
    const identical = normalizeVectorSearchScore({
      provider: 'postgres',
      metric: VectorSimilarity.Cosine,
      raw: 0,
    });
    expect(identical.score).toBe(1);
    expect(identical.distance).toBe(0);
    expect(identical.comparable).toBe(true);

    const orthogonal = normalizeVectorSearchScore({
      provider: 'postgres',
      metric: 'cosine',
      raw: 1,
    });
    expect(orthogonal.score).toBe(0);
    expect(orthogonal.distance).toBe(1);
  });

  it('does not treat Euclidean or inner-product scores as cross-provider equivalent', () => {
    const mongoEuclidean = normalizeVectorSearchScore({
      provider: 'mongodb',
      metric: VectorSimilarity.Euclidean,
      raw: 0.4,
    });
    const postgresEuclidean = normalizeVectorSearchScore({
      provider: 'postgres',
      metric: VectorSimilarity.Euclidean,
      raw: 0.6,
    });
    const mongoDot = normalizeVectorSearchScore({
      provider: 'mongodb',
      metric: VectorSimilarity.DotProduct,
      raw: 12,
    });
    const postgresDot = normalizeVectorSearchScore({
      provider: 'postgres',
      metric: VectorSimilarity.DotProduct,
      raw: -12,
    });

    expect(mongoEuclidean).toMatchObject({
      score: 0.4,
      comparable: false,
      provider: 'mongodb',
    });
    expect(postgresEuclidean).toMatchObject({
      score: -0.6,
      distance: 0.6,
      comparable: false,
      provider: 'postgres',
    });
    expect(mongoDot.comparable).toBe(false);
    expect(postgresDot).toMatchObject({
      score: 12,
      distance: -12,
      comparable: false,
    });
    expect(mongoEuclidean.score).not.toBe(postgresEuclidean.score);
  });
});
