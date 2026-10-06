import {
  VectorSearchProvider,
  VectorSearchResult,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import type { Indexable } from '@conduitplatform/grpc-sdk';
import { parseVectorSimilarity } from './vectorField.js';

export interface NormalizedVectorScore {
  score: number;
  distance?: number;
  metric: VectorSimilarity;
  provider: VectorSearchProvider;
  comparable: boolean;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/**
 * Convert a backend raw score/distance into the documented result contract.
 *
 * Mongo Atlas `vectorSearchScore` is already higher-is-better.
 * Postgres `<=>` is cosine *distance* (lower-is-better) and is inverted with
 * `1 - distance`. Euclidean and inner-product values are higher-is-better
 * rankings only and must not be treated as comparable across providers.
 */
export function normalizeVectorSearchScore(args: {
  provider: VectorSearchProvider;
  metric: VectorSimilarity | string | undefined;
  raw: unknown;
}): NormalizedVectorScore {
  const raw = finiteNumber(args.raw);
  const metric = parseVectorSimilarity(args.metric);
  switch (metric) {
    case VectorSimilarity.Cosine: {
      if (args.provider === 'postgres') {
        return {
          score: 1 - raw,
          distance: raw,
          metric,
          provider: args.provider,
          comparable: true,
        };
      }
      return {
        score: raw,
        metric,
        provider: args.provider,
        comparable: true,
      };
    }
    case VectorSimilarity.Euclidean: {
      if (args.provider === 'postgres') {
        return {
          score: -raw,
          distance: raw,
          metric,
          provider: args.provider,
          comparable: false,
        };
      }
      return {
        score: raw,
        metric,
        provider: args.provider,
        comparable: false,
      };
    }
    case VectorSimilarity.DotProduct: {
      if (args.provider === 'postgres') {
        // pgvector `<#>` stores the negative inner product.
        return {
          score: -raw,
          distance: raw,
          metric,
          provider: args.provider,
          comparable: false,
        };
      }
      return {
        score: raw,
        metric,
        provider: args.provider,
        comparable: false,
      };
    }
    default: {
      const exhaustive: never = metric;
      throw new Error(`Unsupported vector similarity '${String(exhaustive)}'`);
    }
  }
}

export function stripVectorScoreField<T extends Indexable>(document: T): T {
  const next = { ...document };
  delete next._score;
  return next;
}

export function toVectorSearchResult<T extends Indexable>(
  document: T,
  normalized: NormalizedVectorScore,
): VectorSearchResult<T> {
  return {
    document,
    score: normalized.score,
    ...(normalized.distance !== undefined ? { distance: normalized.distance } : {}),
    metric: normalized.metric,
    provider: normalized.provider,
  };
}
