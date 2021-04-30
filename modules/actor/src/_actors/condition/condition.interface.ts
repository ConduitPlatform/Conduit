export interface ConditionInputs {
  conditions: [
    {
      comparisonFieldA: string;
      condition: 'and' | 'or' | 'xor' | 'gt' | 'gte' | 'lt' | 'lte';
      comparisonFieldB: string;
      successActor: string;
    }
  ];
  defaultConditionActor: string;
}
