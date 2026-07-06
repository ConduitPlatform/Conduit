import { describe, expect, it, jest } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';
import { SchemaAdmin } from '../schema.admin.js';
import { DatabaseAdapter } from '../../adapters/DatabaseAdapter.js';
import { MongooseSchema } from '../../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../../adapters/sequelize-adapter/SequelizeSchema.js';
import { SchemaController } from '../../controllers/cms/schema.controller.js';
import { CustomEndpointController } from '../../controllers/customEndpoints/customEndpoint.controller.js';

function makeCall(params: Record<string, unknown>): ParsedRouterRequest {
  return { request: { params } } as unknown as ParsedRouterRequest;
}

function makeRequestedSchema(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'schema-1',
    name: 'TestSchema',
    fields: { title: 'String' },
    modelOptions: {
      conduit: {
        cms: { enabled: true },
        authorization: { enabled: false },
        permissions: {
          extendable: true,
          canCreate: true,
          canModify: 'Everything',
          canDelete: true,
        },
      },
    },
    ...overrides,
  };
}

function setup(requestedSchema: ReturnType<typeof makeRequestedSchema>) {
  const findOne = jest.fn().mockResolvedValue(requestedSchema);
  const deleteMany = jest.fn().mockResolvedValue(undefined);
  const getSchemaModel = jest.fn().mockReturnValue({ model: { findOne, deleteMany } });
  const isAvailable = jest.fn().mockReturnValue(true);
  const createSchema = jest
    .fn()
    .mockImplementation((schema: unknown) => Promise.resolve(schema));

  const database = { getSchemaModel } as unknown as DatabaseAdapter<
    MongooseSchema | SequelizeSchema
  >;
  const grpcSdk = { isAvailable } as unknown as ConduitGrpcSdk;
  const schemaController = { createSchema } as unknown as SchemaController;
  const customEndpointController = {} as unknown as CustomEndpointController;

  const admin = new SchemaAdmin(
    grpcSdk,
    database,
    schemaController,
    customEndpointController,
  );
  return { admin, findOne, deleteMany, getSchemaModel, isAvailable, createSchema };
}

function schemaNameArgs(getSchemaModel: ReturnType<typeof setup>['getSchemaModel']) {
  return getSchemaModel.mock.calls.map((call: unknown[]) => call[0]);
}

describe('SchemaAdmin PUT/PATCH split', () => {
  describe('putSchema', () => {
    it('replaces the fields map entirely instead of merging', async () => {
      const requestedSchema = makeRequestedSchema({
        fields: { title: 'String', legacy: 'String' },
      });
      const { admin, createSchema } = setup(requestedSchema);

      await admin.putSchema(makeCall({ id: 'schema-1', fields: { name: 'String' } }));

      expect(createSchema).toHaveBeenCalledTimes(1);
      const [writtenSchema, operation] = createSchema.mock.calls[0];
      expect(writtenSchema.fields).toEqual({ name: 'String' });
      expect(operation).toBe('update');
    });

    it('throws INVALID_ARGUMENT when fields is missing', async () => {
      const { admin } = setup(makeRequestedSchema());

      await expect(admin.putSchema(makeCall({ id: 'schema-1' }))).rejects.toMatchObject({
        code: status.INVALID_ARGUMENT,
      });
    });

    it('throws INVALID_ARGUMENT when fields is an empty object', async () => {
      const { admin } = setup(makeRequestedSchema());

      await expect(
        admin.putSchema(makeCall({ id: 'schema-1', fields: {} })),
      ).rejects.toMatchObject({ code: status.INVALID_ARGUMENT });
    });

    it('validates the fields being written, not the schema previous state', async () => {
      const { admin } = setup(makeRequestedSchema());

      await expect(
        admin.putSchema(
          makeCall({ id: 'schema-1', fields: { bad: { type: 'NotARealType' } } }),
        ),
      ).rejects.toMatchObject({ code: status.INTERNAL });
    });

    it('wipes existing documents when enabling authorization', async () => {
      const requestedSchema = makeRequestedSchema();
      const { admin, getSchemaModel, deleteMany } = setup(requestedSchema);

      await admin.putSchema(
        makeCall({
          id: 'schema-1',
          fields: { title: 'String' },
          conduitOptions: { authorization: { enabled: true } },
        }),
      );

      expect(schemaNameArgs(getSchemaModel)).toContain('TestSchema');
      expect(deleteMany).toHaveBeenCalledWith({});
    });

    it('throws FAILED_PRECONDITION when enabling authorization without the service available', async () => {
      const { admin, isAvailable } = setup(makeRequestedSchema());
      isAvailable.mockReturnValue(false);

      await expect(
        admin.putSchema(
          makeCall({
            id: 'schema-1',
            fields: { title: 'String' },
            conduitOptions: { authorization: { enabled: true } },
          }),
        ),
      ).rejects.toMatchObject({ code: status.FAILED_PRECONDITION });
    });
  });

  describe('patchSchema', () => {
    it('updates conduitOptions only, preserving existing fields', async () => {
      const requestedSchema = makeRequestedSchema({
        fields: { title: 'String', legacy: 'String' },
      });
      const { admin, createSchema } = setup(requestedSchema);

      await admin.patchSchema(
        makeCall({ id: 'schema-1', conduitOptions: { cms: { enabled: false } } }),
      );

      expect(createSchema).toHaveBeenCalledTimes(1);
      const [writtenSchema] = createSchema.mock.calls[0];
      expect(writtenSchema.fields).toEqual({ title: 'String', legacy: 'String' });
      expect(writtenSchema.modelOptions.conduit.cms.enabled).toBe(false);
    });

    it('throws INVALID_ARGUMENT when neither fields nor conduitOptions are provided', async () => {
      const { admin } = setup(makeRequestedSchema());

      await expect(admin.patchSchema(makeCall({ id: 'schema-1' }))).rejects.toMatchObject(
        {
          code: status.INVALID_ARGUMENT,
        },
      );
    });

    it('delegates to putSchema and fully replaces fields when fields are provided (deprecation bridge)', async () => {
      const requestedSchema = makeRequestedSchema({
        fields: { title: 'String', legacy: 'String' },
      });
      const { admin, createSchema } = setup(requestedSchema);
      const putSchemaSpy = jest.spyOn(admin, 'putSchema');
      const warnSpy = jest
        .spyOn(ConduitGrpcSdk.Logger, 'warn')
        .mockImplementation(() => {});

      const call = makeCall({ id: 'schema-1', fields: { name: 'String' } });
      await admin.patchSchema(call);

      expect(putSchemaSpy).toHaveBeenCalledWith(call);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/PUT/);
      const [writtenSchema] = createSchema.mock.calls[0];
      expect(writtenSchema.fields).toEqual({ name: 'String' });

      warnSpy.mockRestore();
    });

    it('wipes existing documents when enabling authorization via conduitOptions', async () => {
      const requestedSchema = makeRequestedSchema();
      const { admin, deleteMany } = setup(requestedSchema);

      await admin.patchSchema(
        makeCall({
          id: 'schema-1',
          conduitOptions: { authorization: { enabled: true } },
        }),
      );

      expect(deleteMany).toHaveBeenCalledWith({});
    });
  });
});
