import ConduitGrpcSdk, {
  ConduitSchema,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isEmpty, isNil, merge } from 'lodash';
import { validatePermissions, validateSchemaInput } from '../utils/utilities';
import { SchemaController } from '../controllers/cms/schema.controller';
import { CustomEndpointController } from '../controllers/customEndpoints/customEndpoint.controller';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { _ConduitSchema, ParsedQuery } from '../interfaces';
import { SchemaConverter } from '../utils/SchemaConverter';
import { parseSortParam } from '../handlers/utils';
import escapeStringRegexp from 'escape-string-regexp';

export class SchemaAdmin {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    private readonly schemaController: SchemaController,
    private readonly customEndpointController: CustomEndpointController,
  ) {}

  async exportCustomSchemas(): Promise<UnparsedRouterResponse> {
    return await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findMany(
        { 'modelOptions.conduit.cms.enabled': true },
        {
          select:
            'name parentSchema fields extensions modelOptions ownerModule collectionName',
          sort: {
            updatedAt: 1,
          },
        },
      )
      .then(r => {
        return { schemas: r };
      });
  }

  async importCustomSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const schemas = call.request.params.schemas;
    for (const schema of schemas) {
      const existingSchema = await this.database
        .getSchemaModel('_DeclaredSchema')
        .model.findOne({ name: schema.name });
      const operation = isNil(existingSchema) ? 'create' : 'update';
      const imported = schema.modelOptions.conduit.imported === true;
      const modelOptions = SchemaConverter.getModelOptions({
        cmsSchema: true,
        existingModelOptions: schema.modelOptions,
        importedSchema: imported,
      });
      try {
        validateSchemaInput(schema.name, schema.fields, modelOptions);
      } catch (err: unknown) {
        throw new GrpcError(status.INTERNAL, (err as Error).message);
      }
      await this.schemaController.createSchema(
        new ConduitSchema(
          schema.name,
          schema.fields,
          modelOptions,
          schema.collectionName,
        ),
        operation,
        imported,
      );
      if (schema.extensions.length > 0) {
        for (const extension of schema.extensions) {
          await this.database.setSchemaExtension(
            schema.name,
            extension.owner,
            extension.fields,
          );
        }
      }
    }
    return 'Schemas imported successfully';
  }

  async getSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const query: ParsedQuery = {
      _id: call.request.params.id,
    };
    const requestedSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findOne(query);
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    return requestedSchema;
  }

  async getSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort, enabled, owner } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;

    const queryArray: Indexable[] = [
      {
        name: { $nin: this.database.systemSchemas },
        $or: [
          { parentSchema: { $exists: false } },
          { parentSchema: { $eq: null } },
          { parentSchema: { $eq: '' } },
        ],
      },
    ];
    if (owner && owner?.length !== 0) {
      queryArray.push({ ownerModule: { $in: owner } });
    }
    let identifier;
    if (!isNil(search)) {
      identifier = escapeStringRegexp(search);
      queryArray.push({ name: { $ilike: `%${identifier}%` } });
    }
    if (!isNil(enabled)) {
      if (enabled) {
        queryArray.push({
          $or: [
            { 'modelOptions.conduit.cms.enabled': enabled },
            { 'modelOptions.conduit.permissions.extendable': enabled },
          ],
        });
      } else if (!enabled && (!owner || owner?.length === 0)) {
        queryArray.push({ 'modelOptions.conduit.cms.enabled': enabled });
      }
    }
    const query: ParsedQuery = { $and: queryArray };
    let parsedSort: { [key: string]: -1 | 1 } | undefined = undefined;
    if (sort) {
      parsedSort = parseSortParam(sort);
    }
    const schemasPromise = this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findMany(query, { skip, limit, sort: parsedSort });
    const documentsCountPromise = this.database
      .getSchemaModel('_DeclaredSchema')
      .model.countDocuments(query);

    const [schemas, count] = await Promise.all([schemasPromise, documentsCountPromise]);

    return { schemas, count };
  }

  async getSchemasExtensions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query = '{}';
    let parsedSort: { [key: string]: -1 | 1 } | undefined = undefined;
    if (sort) {
      parsedSort = parseSortParam(sort);
    }
    const schemaAdapter = this.database.getSchemaModel('_DeclaredSchema');
    const schemasExtensionsPromise = schemaAdapter.model.findMany(query, {
      skip,
      limit,
      select: 'name extensions',
      sort: parsedSort,
    });
    const totalCountPromise = schemaAdapter.model.countDocuments(query);

    const [schemasExtensions, count] = await Promise.all([
      schemasExtensionsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    return { schemasExtensions, count };
  }

  async createSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, fields } = call.request.params;
    const existingSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findOne({ name });
    if (existingSchema) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Schema name is already in use!');
    }
    const modelOptions = SchemaConverter.getModelOptions({
      cmsSchema: true,
      cms: call.request.params.conduitOptions?.cms,
      permissions: call.request.params.conduitOptions?.permissions,
      authorization: call.request.params.conduitOptions?.authorization,
      timestamps: call.request.params.timestamps,
    });
    if (
      call.request.params.conduitOptions?.authorization?.enabled &&
      !this.grpcSdk.isAvailable('authorization')
    ) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        'Authorization service is not available',
      );
    }
    try {
      validateSchemaInput(name, fields, modelOptions);
    } catch (err: unknown) {
      throw new GrpcError(status.INTERNAL, (err as Error).message);
    }
    await this.schemaController.createSchema(
      new ConduitSchema(name, fields, modelOptions),
    );
    return await this.database.getSchemaModel('_DeclaredSchema').model.findOne({ name });
  }

  async patchSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, fields } = call.request.params;
    const requestedSchema = await this.checkRequestedSchema(id);
    requestedSchema.fields = fields ?? requestedSchema.fields;
    if (
      !requestedSchema.modelOptions.conduit.authorization?.enabled &&
      call.request.params.conduitOptions?.authorization?.enabled
    ) {
      // wipe all data when enabling authz
      await this.database.getSchemaModel(requestedSchema.name).model.deleteMany({});
    }
    const modelOptions = SchemaConverter.getModelOptions({
      cmsSchema: true,
      cms: call.request.params.conduitOptions?.cms,
      authorization: call.request.params.conduitOptions?.authorization,
      permissions: call.request.params.conduitOptions?.permissions,
      existingModelOptions: requestedSchema.modelOptions,
    });
    if (
      call.request.params.conduitOptions?.authorization?.enabled &&
      !this.grpcSdk.isAvailable('authorization')
    ) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        'Authorization service is not available',
      );
    }
    try {
      validateSchemaInput(requestedSchema.name, fields, modelOptions);
    } catch (err: unknown) {
      throw new GrpcError(status.INTERNAL, (err as Error).message);
    }

    return this.schemaController.createSchema(
      new ConduitSchema(
        requestedSchema.name,
        requestedSchema.fields,
        requestedSchema.modelOptions,
      ),
      'update',
    );
  }

  async deleteSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, deleteData } = call.request.params;
    const requestedSchema = await this.checkRequestedSchema(id);
    // Temp: error out until Admin handles this case
    const endpoints = await this.database
      .getSchemaModel('CustomEndpoints')
      .model.findMany({
        selectedSchema: id,
      });
    if (!isNil(endpoints) && endpoints.length !== 0) {
      throw new GrpcError(
        status.ABORTED,
        'Cannot delete schema because it is used by a custom endpoint',
      );
    }

    const message = await this.database.deleteSchema(
      requestedSchema.name,
      deleteData,
      'database',
    );
    await this.database
      .getSchemaModel('CustomEndpoints')
      .model.deleteMany({ selectedSchema: id });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return message;
  }

  async deleteSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids, deleteData } = call.request.params;
    const requestedSchemas = await this.retrieveSchemasByIds(ids);
    for (const schema of requestedSchemas) {
      const endpoints = await this.database
        .getSchemaModel('CustomEndpoints')
        .model.countDocuments({
          selectedSchema: schema._id,
        });
      if (!isNil(endpoints) && endpoints > 0) {
        // Temp: error out until Admin handles this case
        throw new GrpcError(
          status.ABORTED,
          'Cannot delete schema because it is used by a custom endpoint',
        );
      }
      await this.database.deleteSchema(schema.name, deleteData, 'database');
    }

    await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.deleteMany({ _id: { $in: ids } });
    await this.database
      .getSchemaModel('CustomEndpoints')
      .model.deleteMany({ selectedSchema: { $in: ids } });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return 'Schemas successfully deleted';
  }

  async toggleSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id } = call.request.params;
    const requestedSchema = await this.checkRequestedSchema(id);
    requestedSchema.modelOptions.conduit.cms.enabled =
      !requestedSchema.modelOptions.conduit.cms.enabled;

    const updatedSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findByIdAndUpdate(requestedSchema._id, requestedSchema);
    if (isNil(updatedSchema)) {
      throw new GrpcError(
        status.INTERNAL,
        `Could not ${
          requestedSchema.modelOptions.conduit.cms.enabled ? 'enable' : 'disable'
        } schema`,
      );
    }
    await this.database
      .getSchemaModel('CustomEndpoints')
      .model.updateMany(
        { selectedSchema: call.request.params.id },
        { enabled: requestedSchema.modelOptions.conduit.cms.enabled },
      );

    if (!requestedSchema.modelOptions.conduit.cms.enabled) {
      this.schemaController.refreshRoutes();
    }
    this.customEndpointController.refreshEndpoints();

    return {
      name: updatedSchema.name,
      enabled: updatedSchema.modelOptions.conduit.cms.enabled,
    };
  }

  async toggleSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids, enabled } = call.request.params;
    await this.retrieveSchemasByIds(ids);
    const updatedSchemas = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.updateMany(
        {
          ownerModule: 'database',
          name: { $nin: this.database.systemSchemas },
          _id: { $in: ids },
        },
        { 'modelOptions.conduit.cms.enabled': enabled },
      );
    if (isNil(updatedSchemas)) {
      throw new GrpcError(
        status.INTERNAL,
        `Could not ${enabled ? 'enable' : 'disable'} schemas`,
      );
    }

    await this.database
      .getSchemaModel('CustomEndpoints')
      .model.updateMany({ selectedSchema: { $in: ids } }, { enabled: enabled });

    if (!enabled) {
      this.schemaController.refreshRoutes();
    }
    this.customEndpointController.refreshEndpoints();

    return {
      updatedSchemas,
      enabled,
    };
  }

  async setSchemaExtension(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const requestedSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findOne({ _id: call.request.params.schemaId });
    if (!requestedSchema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    await this.database
      .setSchemaExtension(requestedSchema.name, 'database', call.request.params.fields)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return this.database.getSchema(requestedSchema.name);
  }

  async setSchemaPerms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, extendable, canCreate, canModify, canDelete } = call.request.params;
    const permissions = {
      ...(extendable !== undefined && { extendable }),
      ...(canCreate !== undefined && { canCreate }),
      ...(canModify !== undefined && { canModify }),
      ...(canDelete !== undefined && { canDelete }),
    };
    try {
      validatePermissions(permissions);
    } catch (err: unknown) {
      throw new GrpcError(status.INTERNAL, (err as Error).message);
    }

    const requestedSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findOne({
        $and: [{ name: { $nin: this.database.systemSchemas } }, { _id: id }],
      });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, "Schema does not exist or can't be modified");
    }

    merge(requestedSchema.modelOptions.permissions, permissions);
    const updatedSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findByIdAndUpdate(requestedSchema._id, requestedSchema);
    if (isNil(updatedSchema)) {
      throw new GrpcError(status.INTERNAL, 'Could not update schema permissions');
    }

    return 'Schema permissions updated successfully';
  }

  async getSchemaOwners(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { sort } = call.request.params;
    const modules: string[] = [];
    let parsedSort: { [key: string]: -1 | 1 } | undefined = undefined;
    if (sort) {
      parsedSort = parseSortParam(sort);
    }
    const schemas = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findMany({}, { select: 'ownerModule', sort: parsedSort });
    schemas.forEach((schema: ConduitSchema) => {
      if (!modules.includes(schema.ownerModule)) modules.push(schema.ownerModule);
    });
    return { modules };
  }

  async getIntrospectionStatus(): Promise<UnparsedRouterResponse> {
    let foreignSchemas = Array.from(this.database.foreignSchemaCollections);
    const pendingSchemas = (
      await this.database.getSchemaModel('_PendingSchemas').model.findMany({})
    ).map(
      (schema: { name: string; collectionName?: string }) =>
        schema.collectionName ?? schema.name,
    );
    foreignSchemas = foreignSchemas.filter(foreign => {
      return !pendingSchemas.find((pending: string) => {
        return pending === foreign;
      });
    });
    const importedSchemas: string[] = (
      await this.database
        .getSchemaModel('_DeclaredSchema')
        .model.findMany({ 'modelOptions.conduit.imported': true })
    ).map((schema: ConduitSchema) => schema.collectionName);
    return {
      foreignSchemas,
      foreignSchemaCount: foreignSchemas.length,
      pendingSchemas,
      pendingSchemasCount: pendingSchemas.length,
      importedSchemas,
      importedSchemaCount: importedSchemas.length,
    };
  }

  async introspectDatabase(): Promise<UnparsedRouterResponse> {
    const introspectedSchemas = await this.database.introspectDatabase();
    await Promise.all(
      introspectedSchemas.map(async (schema: ConduitSchema) => {
        if (isEmpty(schema.fields)) return null;
        await this.database.getSchemaModel('_PendingSchemas').model.create(
          JSON.stringify({
            name: schema.name,
            fields: schema.fields,
            modelOptions: schema.modelOptions,
          }),
        );
      }),
    );
    return 'Schemas successfully introspected';
  }

  async getPendingSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const query: ParsedQuery = { _id: call.request.params.id };
    const requestedSchema = await this.database
      .getSchemaModel('_PendingSchemas')
      .model.findOne(query);
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Pending schema does not exist');
    }
    return requestedSchema;
  }

  async getPendingSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;
    let query = {};
    if (!isNil(search)) {
      const identifier = escapeStringRegexp(search);
      query = { name: { $ilike: `%${identifier}%` } };
    }
    let parsedSort: { [key: string]: -1 | 1 } | undefined = undefined;
    if (sort) {
      parsedSort = parseSortParam(sort);
    }
    const schemasPromise = this.database
      .getSchemaModel('_PendingSchemas')
      .model.findMany(query, { skip, limit, sort: parsedSort });
    const schemasCountPromise = this.database
      .getSchemaModel('_PendingSchemas')
      .model.countDocuments(query);
    const [schemas, count] = await Promise.all([schemasPromise, schemasCountPromise]);
    return { schemas, count };
  }

  async finalizeSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const schemas: _ConduitSchema[] = Object.values(call.request.params.schemas); // @dirty-type-cast
    if (schemas.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Argument schemas is required and must be a non-empty array!',
      );
    }
    const schemaNames = schemas.map(schema => schema.name);
    await Promise.all(
      schemas.map(async schema => {
        const importedName = schema.name.startsWith('_')
          ? `imp${schema.name}`
          : `imp_${schema.name}`;

        const modelOptions = SchemaConverter.getModelOptions({
          cmsSchema: true,
          existingModelOptions: schema.modelOptions,
          importedSchema: true,
        });
        const recreatedSchema = new ConduitSchema(
          importedName,
          schema.fields,
          modelOptions,
        );
        if (isNil(recreatedSchema.fields)) return null;
        recreatedSchema.ownerModule = 'database';
        (recreatedSchema as _ConduitSchema).collectionName = // @dirty-type-cast
          this.database.getCollectionName(schema); //keep collection name without prefix
        await this.database.createSchemaFromAdapter(recreatedSchema, true);
      }),
    );
    await this.database
      .getSchemaModel('_PendingSchemas')
      .model.deleteMany({ name: { $in: schemaNames } });
    return `${schemas.length} ${
      schemas.length > 1 ? 'schemas' : 'schema'
    } finalized successfully`;
  }

  async getDbSystemSchemas(): Promise<UnparsedRouterResponse> {
    return {
      databaseSystemSchemas: this.database.systemSchemas,
    };
  }

  async getDatabaseType(): Promise<UnparsedRouterResponse> {
    const test1 = await this.database.getSchemaModel('File').model.findMany(
      {
        _id: '64a41678894aa4e2c0fdbc08',
      },
      { userId: '64a415a2894aa4e2c0fdbb3f' },
    );
    const test2 = await this.database.getSchemaModel('File').model.findMany(
      {
        _id: '64a41678894aa4e2c0fdbc08',
      },
      { userId: '64a415b2894aa4e2c0fdbb42' },
    );
    const test3 = await this.database
      .getSchemaModel('AccessToken')
      .model.findMany({}, { populate: ['user'] });
    return this.database.getDatabaseType();
  }

  async createIndexes(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, indexes } = call.request.params;
    const requestedSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findOne({ _id: id });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    return await this.database.createIndexes(requestedSchema.name, indexes, 'database');
  }

  async getIndexes(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const id = call.request.params.id;
    const requestedSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findOne({ _id: id });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    return this.database.getIndexes(requestedSchema.name);
  }

  async deleteIndexes(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, indexNames } = call.request.params;
    const requestedSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findOne({ _id: id });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    if (isNil(indexNames) || indexNames.length === 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Index names should be a string array',
      );
    }
    return this.database.deleteIndexes(requestedSchema.name, indexNames);
  }

  async checkRequestedSchema(id: string) {
    const requestedSchema = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findOne({
        $and: [{ 'modelOptions.conduit.cms': { $exists: true } }, { _id: id }],
      });
    if (isNil(requestedSchema)) {
      throw new GrpcError(
        status.NOT_FOUND,
        "Schema does not exist or isn't a CMS schema",
      );
    }
    return requestedSchema;
  }

  private async retrieveSchemasByIds(ids: string[]) {
    if (ids.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Argument ids is required and must be a non-empty array!',
      );
    }

    const requestedSchemas = await this.database
      .getSchemaModel('_DeclaredSchema')
      .model.findMany({
        $and: [{ 'modelOptions.conduit.cms': { $exists: true } }, { _id: { $in: ids } }],
      });
    if (!requestedSchemas || requestedSchemas.length === 0) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }
    return requestedSchemas;
  }
}
