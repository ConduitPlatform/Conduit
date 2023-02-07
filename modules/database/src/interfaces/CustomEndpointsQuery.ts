export interface CustomEndpointsQuery {
  schemaField: string;
  operation: number;
  comparisonField: {
    type: string;
    value: any;
    like?: boolean;
    caseSensitiveLike?: boolean;
  };
}
