import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  CompatibleIndexType,
  ConduitGrpcSdk,
  ConduitSchema,
  MongoIndexType,
  PostgresIndexType,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { schemaConverter } from '../SchemaConverter.js';

describe('mongoose SchemaConverter indexes T17 T23', () => {
  beforeEach(() => {
    jest.spyOn(ConduitGrpcSdk.Logger, 'warn').mockImplementation(() => {});
  });

  it('T17 treats Compatible as Mongo 1/-1', () => {
    const converted = schemaConverter(
      new ConduitSchema(
        'User',
        {
          email: {
            type: TYPE.String,
            index: { type: CompatibleIndexType.Descending },
          },
        } as any,
        {},
      ),
    );
    expect((converted.fields.email as any).index.type).toBe(MongoIndexType.Descending);
  });

  it('T23 recover: postgres leftovers on Mongo are warned and skipped', () => {
    const warn = ConduitGrpcSdk.Logger.warn as jest.Mock;
    const converted = schemaConverter(
      new ConduitSchema(
        'User',
        {
          email: {
            type: TYPE.String,
            index: { type: PostgresIndexType.GIN },
          },
        } as any,
        {},
      ),
    );
    expect((converted.fields.email as any).index).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('does not treat the Mongo enum key "Ascending" as a valid Mongo type', () => {
    const converted = schemaConverter(
      new ConduitSchema(
        'User',
        {
          email: {
            type: TYPE.String,
            index: { type: 'Ascending' as any },
          },
        } as any,
        {},
      ),
    );
    expect((converted.fields.email as any).index.type).toBe(MongoIndexType.Ascending);
  });
});
