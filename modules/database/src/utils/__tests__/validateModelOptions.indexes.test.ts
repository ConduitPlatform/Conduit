import { describe, expect, it } from '@jest/globals';
import { CompatibleIndexType } from '@conduitplatform/grpc-sdk';
import { validateSchemaInput } from '../utilities.js';

describe('validateModelOptions T35 T36', () => {
  it('T35 accepts modelOptions.indexes', () => {
    expect(() =>
      validateSchemaInput(
        'User',
        { email: 'String' },
        {
          timestamps: true,
          indexes: [{ fields: ['email'], types: [CompatibleIndexType.Ascending] }],
        },
      ),
    ).not.toThrow();
  });

  it('T36 keeps conduit.readPreference while accepting indexes', () => {
    expect(() =>
      validateSchemaInput(
        'User',
        { email: 'String' },
        {
          timestamps: true,
          indexes: [{ fields: ['email'] }],
          conduit: { readPreference: 'secondaryPreferred' },
        },
      ),
    ).not.toThrow();
  });

  it('still rejects unknown conduit keys and unknown model option keys', () => {
    expect(() =>
      validateSchemaInput('User', { email: 'String' }, {
        unknown: true,
      } as any),
    ).toThrow(/indexes/);
    expect(() =>
      validateSchemaInput('User', { email: 'String' }, {
        conduit: { notARealKey: true },
      } as any),
    ).toThrow(/readPreference/);
  });
});
