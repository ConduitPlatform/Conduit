import { describe, expect, it, jest } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';
import { SchemaAdmin } from '../schema.admin.js';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema.js';
import { SchemaController } from '../../controllers/cms/schema.controller.js';
import { CustomEndpointController } from '../../controllers/customEndpoints/customEndpoint.controller.js';
import { ADMIN_INDEX_CALLER } from '../../adapters/utils/indexes.js';

function makeCall(params: Record<string, unknown>): ParsedRouterRequest {
  return { request: { params } } as unknown as ParsedRouterRequest;
}

function setup() {
  const findOne = jest.fn().mockResolvedValue({
    _id: 'schema-1',
    name: 'User',
    ownerModule: 'database',
  });
  const findMany = jest.fn().mockResolvedValue([{ name: 'User' }, { name: 'ChatRoom' }]);
  const countDocuments = jest.fn().mockResolvedValue(2);
  const createIndexes = jest.fn().mockResolvedValue('Indexes created!');
  const getIndexes = jest
    .fn()
    .mockResolvedValue([{ name: 'cnd_idx_email_asc', fields: ['email'] }]);
  const deleteIndexes = jest.fn().mockResolvedValue('Indexes deleted');
  const getSchemaModel = jest.fn().mockReturnValue({
    model: { findOne, findMany, countDocuments },
  });
  const database = {
    getSchemaModel,
    createIndexes,
    getIndexes,
    deleteIndexes,
    systemSchemas: ['_DeclaredSchema'],
    models: {
      User: { originalSchema: { ownerModule: 'database' } },
      ChatRoom: { originalSchema: { ownerModule: 'chat' } },
    },
  } as unknown as DatabaseAdapter<MongooseSchema | SequelizeSchema>;
  const admin = new SchemaAdmin(
    {} as ConduitGrpcSdk,
    database,
    {} as SchemaController,
    {} as CustomEndpointController,
  );
  return { admin, createIndexes, getIndexes, findMany, countDocuments, findOne };
}

describe('SchemaAdmin indexes T35–T42', () => {
  it('T37 Admin createIndexes is privileged', async () => {
    const { admin, createIndexes } = setup();
    await admin.createIndexes(
      makeCall({
        id: 'schema-1',
        indexes: [{ fields: ['email'], options: { unique: true } }],
      }),
    );
    expect(createIndexes).toHaveBeenCalledWith(
      'User',
      [{ fields: ['email'], options: { unique: true } }],
      ADMIN_INDEX_CALLER,
      { privileged: true },
    );
  });

  it('T39 exportIndexes is paginated (skip/limit, no unbounded findMany)', async () => {
    const { admin, findMany, countDocuments, getIndexes } = setup();
    const result = (await admin.exportIndexes(makeCall({ skip: 10, limit: 5 }))) as {
      indexes: unknown[];
      count: number;
    };
    expect(findMany).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ skip: 10, limit: 5 }),
    );
    expect(countDocuments).toHaveBeenCalled();
    expect(getIndexes).toHaveBeenCalled();
    expect(result.count).toBe(2);
    expect(result.indexes.every(index => 'schemaName' in (index as object))).toBe(true);
  });

  it('T40 importIndexes skips same-name indexes', async () => {
    const { admin, createIndexes, getIndexes } = setup();
    getIndexes.mockResolvedValue([{ name: 'keep_me', fields: ['email'] }]);
    await admin.importIndexes(
      makeCall({
        indexes: [
          { schemaName: 'User', fields: ['email'], name: 'keep_me' },
          { schemaName: 'User', fields: ['name'], name: 'new_name' },
        ],
      }),
    );
    expect(createIndexes).toHaveBeenCalledTimes(1);
    const created = createIndexes.mock.calls[0][1] as { name?: string }[];
    expect(created.map(i => i.name)).toEqual(['new_name']);
  });

  it('T41 import unique is not Admin-privileged (respects owner)', async () => {
    const { admin, createIndexes } = setup();
    await admin.importIndexes(
      makeCall({
        indexes: [
          {
            schemaName: 'ChatRoom',
            fields: ['name'],
            name: 'chat_name',
            options: { unique: true },
          },
        ],
      }),
    );
    expect(createIndexes).toHaveBeenCalledWith(
      'ChatRoom',
      expect.any(Array),
      ADMIN_INDEX_CALLER,
      { privileged: false },
    );
  });

  it('T42 import/export are Admin handlers and reject empty import', async () => {
    const { admin } = setup();
    await expect(admin.importIndexes(makeCall({ indexes: [] }))).rejects.toMatchObject({
      code: status.INVALID_ARGUMENT,
    });
  });
});
