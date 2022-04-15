import ConduitGrpcSdk, {
  ConduitModelOptions,
  ConduitModelOptionsPermModifyType,
  ConduitSchema,
  ConduitSchemaExtension,
  GrpcError,
  ParsedRouterRequest,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil, merge } from 'lodash';
import { validateSchemaInput } from '../utils/utilities';
import { SchemaController } from '../controllers/cms/schema.controller';
import { CustomEndpointController } from '../controllers/customEndpoints/customEndpoint.controller';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';

const escapeStringRegexp = require('escape-string-regexp');

const SYSTEM_SCHEMAS = ['CustomEndpoints','_PendingSchemas']; // DeclaredSchemas is not a DeclaredSchema

export class SchemaAdmin {

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly database: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
    private readonly schemaController: SchemaController,
    private readonly customEndpointController: CustomEndpointController,
  ) {
  }

  async getSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const query: { [p: string]: any } = {
      _id: call.request.params.id,
      name: { $nin: SYSTEM_SCHEMAS },
    };
    const requestedSchema = await this.database.getSchemaModel('_DeclaredSchema').model.findOne(query);
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    return requestedSchema;
  }

  async getSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort, enabled, owner } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;
    let query: { [p: string]: any } = { name: { $nin: SYSTEM_SCHEMAS } };
    if (owner && owner.length !== 0) {
      query = {
        $and: [
          query,
          { ownerModule: { $in: owner } },
        ],
      };
    }
    let identifier;
    if (!isNil(search)) {
      identifier = escapeStringRegexp(search);
      query['name'] = { $regex: `.*${identifier}.*`, $options: 'i' };
    }
    if (!isNil(enabled)) {
      const enabledQuery = { $or: [{ ownerModule: { $ne: 'database' } }, { 'modelOptions.conduit.cms.enabled': true }] };
      const disabledQuery = { 'modelOptions.conduit.cms.enabled': false };
      query = {
        $and: [
          query,
          enabled ? enabledQuery : disabledQuery,
        ],
      };
    }

    const schemasPromise = await this.database.getSchemaModel('_DeclaredSchema').model.findMany(
      query,
      skip,
      limit,
      sort,
    );
    const documentsCountPromise = await this.database.getSchemaModel('_DeclaredSchema').model.countDocuments(query);

    const [schemas, count] = await Promise.all([
      schemasPromise,
      documentsCountPromise,
    ]);

    return { schemas, count };
  }

  async getSchemasExtensions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query = '{}';
    const schemaAdapter = this.database.getSchemaModel('_DeclaredSchema');
    const schemasExtensionsPromise = schemaAdapter.model
      .findMany(
        query,
        skip,
        limit,
        'name extensions',
        undefined,
      );
    const totalCountPromise = schemaAdapter.model.countDocuments(query);

    const [schemasExtensions, totalCount] = await Promise.all([
      schemasExtensionsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    return { schemasExtensions, totalCount };
  }

  async createSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const {
      name,
      fields,
      modelOptions,
      permissions,
    } = call.request.params;
    const enabled = call.request.params.enabled ?? true;
    const authentication = call.request.params.authentication ?? false;
    const crudOperations = call.request.params.crudOperations ?? true;

    if (name.indexOf('-') >= 0 || name.indexOf(' ') >= 0) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Names cannot include spaces and - characters',
      );
    }
    const errorMessage = validateSchemaInput(name, fields, modelOptions, enabled);
    if (!isNil(errorMessage)) {
      throw new GrpcError(status.INVALID_ARGUMENT, errorMessage);
    }
    if (permissions && permissions.canModify && !(ConduitModelOptionsPermModifyType.includes(permissions.canModify))) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `canModify permission must be one of: ${ConduitModelOptionsPermModifyType.join(', ')}`);
    }

    const existingSchema = await this.database.getSchemaModel('_DeclaredSchema').model
      .findOne({ name });
    if (existingSchema) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Schema name is already in use!');
    }

    Object.assign(fields, {
      _id: TYPE.ObjectId,
      createdAt: TYPE.Date,
      updatedAt: TYPE.Date,
    });

    const schemaOptions = isNil(modelOptions)
      ? { conduit: { cms: { enabled, authentication, crudOperations } } }
      : { ...modelOptions, conduit: { cms: { enabled, authentication, crudOperations } } };
    schemaOptions.conduit.permissions = permissions; // database sets missing perms to defaults

    return this.schemaController
      .createSchema(
        new ConduitSchema(
          name,
          fields,
          schemaOptions,
        ),
      );
  }

  async patchSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const {
      id,
      name,
      fields,
      modelOptions,
      permissions,
    } = call.request.params;

    if (!isNil(name) && name !== '') {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Name of existing schema cannot be edited',
      );
    }

    const requestedSchema = await this.database.getSchemaModel('_DeclaredSchema').model.findOne({
      ownerModule: 'database', name: { $nin: SYSTEM_SCHEMAS },
      _id: id,
    });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    const errorMessage = validateSchemaInput(requestedSchema.name, fields, modelOptions);
    if (!isNil(errorMessage)) {
      throw new GrpcError(status.INTERNAL, errorMessage);
    }
    if (permissions) {
      this.patchSchemaPerms(requestedSchema, permissions);
    }
    requestedSchema.name = name ? name : requestedSchema.name;
    requestedSchema.fields = fields ? fields : requestedSchema.fields;
    const enabled = call.request.params.enabled ?? requestedSchema.modelOptions.conduit.cms.enabled;

    const authentication = call.request.params.authentication ?? requestedSchema.modelOptions.conduit.cms.authentication;
    const crudOperations = call.request.params.crudOperations ?? requestedSchema.modelOptions.conduit.cms.crudOperations;
    requestedSchema.modelOptions = merge(
      requestedSchema.modelOptions,
      modelOptions,
      { conduit: { cms: { enabled, authentication, crudOperations } } },
    );


    const updatedSchema = await this.database
      .createCustomSchemaFromAdapter(
        new ConduitSchema(
          requestedSchema.name,
          requestedSchema.fields,
          requestedSchema.modelOptions,
        ),
      );
    if (isNil(updatedSchema)) {
      throw new GrpcError(status.INTERNAL, 'Could not update schema');
    }

    // Mongoose requires that schemas are re-created in order to update them
    if (enabled) {
      await this.schemaController.createSchema(
        new ConduitSchema(
          updatedSchema.originalSchema.name,
          updatedSchema.originalSchema.fields,
          updatedSchema.originalSchema.schemaOptions,
        ),
      );
    }

    return updatedSchema.originalSchema;
  }

  async deleteSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, deleteData } = call.request.params;

    const requestedSchema = await this.database.getSchemaModel('_DeclaredSchema').model.findOne({
      ownerModule: 'database',
      name: { $nin: SYSTEM_SCHEMAS },
      _id: id,
    });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    // Temp: error out until Admin handles this case
    const endpoints = await this.database.getSchemaModel('CustomEndpoints').model.findMany({
      selectedSchema: id,
    });
    if (!isNil(endpoints) && endpoints.length !== 0) {
      throw new GrpcError(
        status.ABORTED,
        'Cannot delete schema because it is used by a custom endpoint',
      );
    }

    await this.database.getSchemaModel('_DeclaredSchema').model
      .deleteOne(requestedSchema);
    await this.database.getSchemaModel('CustomEndpoints').model
      .deleteMany({ selectedSchema: id });
    const message = await this.database
      .deleteSchema(requestedSchema.name, deleteData, 'database');

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return message;
  }

  async deleteSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids, deleteData } = call.request.params;
    if (ids.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Argument ids is required and must be a non-empty array!',
      );
    }

    const requestedSchemas = await this.database.getSchemaModel('_DeclaredSchema').model.findMany({
      ownerModule: 'database',
      name: { $nin: SYSTEM_SCHEMAS },
      _id: { $in: ids },
    });
    if (requestedSchemas.length === 0) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }
    const foundSchemas = await this.database.getSchemaModel('_DeclaredSchema').model.countDocuments({
      ownerModule: 'database', name: { $nin: SYSTEM_SCHEMAS },
      _id: { $in: ids },
    });
    if (foundSchemas !== requestedSchemas.length) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }

    for (const schema of requestedSchemas) {
      const endpoints = await this.database.getSchemaModel('CustomEndpoints').model.countDocuments({
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

    await this.database.getSchemaModel('_DeclaredSchema').model
      .deleteMany({ _id: { $in: ids } });
    await this.database.getSchemaModel('CustomEndpoints').model
      .deleteMany({ selectedSchema: { $in: ids } });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return 'Schemas successfully deleted';
  }

  async toggleSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const requestedSchema = await this.database.getSchemaModel('_DeclaredSchema').model.findOne({
      ownerModule: 'database', name: { $nin: SYSTEM_SCHEMAS },
      _id: call.request.params.id,
    });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    requestedSchema.modelOptions.conduit.cms.enabled =
      !requestedSchema.modelOptions.conduit.cms.enabled;

    const updatedSchema = await this.database.getSchemaModel('_DeclaredSchema').model.findByIdAndUpdate(
      requestedSchema._id,
      requestedSchema,
    );
    if (isNil(updatedSchema)) {
      throw new GrpcError(
        status.INTERNAL,
        `Could not ${
          requestedSchema.modelOptions.conduit.cms.enabled
            ? 'enable'
            : 'disable'
        } schema`,
      );
    }
    await this.database.getSchemaModel('CustomEndpoints').model
      .updateMany(
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
    if (ids.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Argument ids is required and must be a non-empty array!',
      );
    }

    const requestedSchemas = await this.database.getSchemaModel('_DeclaredSchema').model.findMany({
      ownerModule: 'database', name: { $nin: SYSTEM_SCHEMAS },
      _id: { $in: ids },
    });
    if (isNil(requestedSchemas)) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }
    const foundDocumentsCount = await this.database.getSchemaModel('_DeclaredSchema').model.countDocuments({
      ownerModule: 'database', name: { $nin: SYSTEM_SCHEMAS },
      _id: { $in: ids },
    });
    if (foundDocumentsCount !== requestedSchemas.length) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }

    const updatedSchemas = await this.database.getSchemaModel('_DeclaredSchema').model.updateMany(
      {
        ownerModule: 'database', name: { $nin: SYSTEM_SCHEMAS },
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

    await this.database.getSchemaModel('CustomEndpoints').model
      .updateMany({ selectedSchema: { $in: ids } }, { enabled: enabled });

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
    const requestedSchema = await this.database.getSchemaModel('_DeclaredSchema').model.findOne({ _id: call.request.params.schemaId });
    if (!requestedSchema) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    const extension = new ConduitSchemaExtension(
      requestedSchema.name,
      call.request.params.fields,
    );
    let base = await this.database.getBaseSchema(requestedSchema.name);
    await this.database.setSchemaExtension(base, 'database', extension.modelSchema)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    return await this.database.getSchema(requestedSchema.name);
  }

  async setSchemaPerms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let { id, extendable, canCreate, canModify, canDelete } = call.request.params;

    const requestedSchema = await this.database.getSchemaModel('_DeclaredSchema').model.findOne({
      ownerModule: 'database', name: { $nin: SYSTEM_SCHEMAS },
      _id: id,
    });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    this.patchSchemaPerms(
      requestedSchema,
      { extendable, canCreate, canModify, canDelete },
    );

    const updatedSchema = await this.database.getSchemaModel('_DeclaredSchema').model.findByIdAndUpdate(
      requestedSchema._id,
      requestedSchema,
    );
    if (isNil(updatedSchema)) {
      throw new GrpcError(status.INTERNAL, 'Could not update schema permissions');
    }

    return 'Schema permissions updated successfully';
  }

  async getSchemaOwners(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const modules: string[] = [];
    const schemas = await this.database.getSchemaModel('_DeclaredSchema').model.findMany(
      {},
      undefined,
      undefined,
      'ownerModule'
    );
    schemas.forEach((schema: any) => {
      if (!modules.includes(schema.ownerModule)) modules.push(schema.ownerModule);
    });
    return { modules };
  }

  async introspectDatabase(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    await this.database.introspectDatabase();
    return { introspect: 'success'};
  }

  private patchSchemaPerms(
    schema: any,
    // @ts-ignore
    perms: ConduitModelOptions['conduit']['permissions'],
  ) {
    if (perms!.canModify && !(ConduitModelOptionsPermModifyType.includes(perms!.canModify))) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        `canModify permission must be one of: ${ConduitModelOptionsPermModifyType.join(', ')}`);
    }
    (schema.modelOptions.conduit as any).permissions.extendable =
      perms!.extendable ?? (schema.modelOptions.conduit as any).permissions.extendable;
    (schema.modelOptions.conduit as any).permissions.canCreate =
      perms!.canCreate ?? (schema.modelOptions.conduit as any).permissions.canCreate;
    (schema.modelOptions.conduit as any).permissions.canModify =
      perms!.canModify ?? (schema.modelOptions.conduit as any).permissions.canModify;
    (schema.modelOptions.conduit as any).permissions.canDelete =
      perms!.canDelete ?? (schema.modelOptions.conduit as any).permissions.canDelete;
  }
}
