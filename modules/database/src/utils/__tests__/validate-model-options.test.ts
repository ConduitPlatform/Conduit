import { describe, expect, it } from '@jest/globals';
import { validateSchemaInput } from '../utilities.js';

const baseConduit = {
  cms: { enabled: true },
  authorization: { enabled: false },
  permissions: {
    extendable: true,
    canCreate: true,
    canModify: 'Everything' as const,
    canDelete: true,
  },
};

describe('validateSchemaInput modelOptions.conduit', () => {
  it('allows conduit.realtime used by live document updates', () => {
    expect(() =>
      validateSchemaInput('TestSchema', undefined, {
        conduit: {
          ...baseConduit,
          realtime: { enabled: true },
        },
      }),
    ).not.toThrow();
  });

  it('rejects an unknown conduit field', () => {
    expect(() =>
      validateSchemaInput('TestSchema', undefined, {
        conduit: {
          ...baseConduit,
          notARealField: true,
        },
      }),
    ).toThrow(/fields allowed inside 'conduit' field/);
  });
});
