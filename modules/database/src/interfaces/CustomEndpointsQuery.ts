export type LikeComparison = 'sensitive' | 'insensitive' | undefined;

export interface CustomEndpointsQuery {
  schemaField: string;
  operation: number;
  comparisonField: { type: string; value: any; like: LikeComparison };
}
