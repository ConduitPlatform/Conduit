import ConduitGrpcSdk, {
  ConduitSchema,
  DatabaseProvider,
  GrpcError,
  ParsedRouterRequest,
  TYPE,
  UnparsedRouterResponse,
  ConduitModelOptions,
  ConduitModelOptionsPermModifyType,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil, merge } from 'lodash';
import { validateSchemaInput } from '../utils/utilities';
import { SchemaController } from '../controllers/cms/schema.controller';
import { CustomEndpointController } from '../controllers/customEndpoints/customEndpoint.controller';
import { CustomEndpoints, _DeclaredSchema } from '../models';

const escapeStringRegexp = require('escape-string-regexp');

const CMS_SYSTEM_SCHEMAS = ['CustomEndpoints']; // excluded DeclaredSchemas

export class SchemaAdmin {
  private readonly database: DatabaseProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly schemaController: SchemaController,
    private readonly customEndpointController: CustomEndpointController
  ) {
    this.database = this.grpcSdk.databaseProvider!;
  }

  async getSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const requestedSchema = await _DeclaredSchema.getInstance().findOne({
      ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
      _id: call.request.params.id,
    });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    return requestedSchema;
  }

  async getSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { search, sort, enabled } = call.request.params;
    const skip = call.request.params.skip ?? 0;
    const limit = call.request.params.limit ?? 25;
    let query: any = { ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS } },
      identifier;
    if (!isNil(search)) {
      identifier = escapeStringRegexp(search);
      query['name'] = { $regex: `.*${identifier}.*`, $options: 'i' };
    }
    if (!isNil(enabled)) {
      query['modelOptions.conduit.cms.enabled'] = enabled;
    }

    const schemasPromise = _DeclaredSchema.getInstance().findMany(
      query,
      undefined,
      skip,
      limit,
      sort
    );
    const documentsCountPromise = _DeclaredSchema.getInstance().countDocuments(query);

    const [schemas, count] = await Promise.all([
      schemasPromise,
      documentsCountPromise,
    ]).catch((e) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    return { schemas, count };
  }

  async getSchemasFromOtherModules(
    call: ParsedRouterRequest
  ): Promise<UnparsedRouterResponse> {
    const allSchemas = await this.database.getSchemas().catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    const schemasFromCMS = await _DeclaredSchema.getInstance().findMany({
      ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS }
    });
    const schemaNamesFromCMS = (schemasFromCMS as _DeclaredSchema[]).map(
      (schema: _DeclaredSchema) => schema.name
    );
    const schemasFromOtherModules = allSchemas.filter((schema: any) => {
      return !schemaNamesFromCMS.includes(schema.name);
    });

    return {
      externalSchemas: schemasFromOtherModules.map((schema: any) => {
        return { name: schema.name, fields: schema.modelSchema };
      }),
    };
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
        'Names cannot include spaces and - characters'
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

    const existingSchema = await _DeclaredSchema.getInstance()
      .findOne({ name })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
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
      : { ...modelOptions, conduit: { cms: { enabled, authentication, crudOperations } } }
    schemaOptions.conduit.permissions = permissions; // database sets missing perms to defaults

    return await this.schemaController
      .createSchema(
        new ConduitSchema(
          name,
          fields,
          schemaOptions,
        )
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
        'Name of existing schema cannot be edited'
      );
    }

    const requestedSchema = await _DeclaredSchema.getInstance().findOne({
      ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
      _id: id
    });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    const errorMessage = validateSchemaInput(requestedSchema.name, fields, modelOptions);
    if (!isNil(errorMessage)) {
      throw new GrpcError(status.INTERNAL, errorMessage);
    }

    this.patchSchemaPerms(requestedSchema, permissions);
    requestedSchema.name = name ? name : requestedSchema.name;
    requestedSchema.fields = fields ? fields : requestedSchema.fields;
    const enabled = call.request.params.enabled ?? requestedSchema.modelOptions.conduit.cms.enabled;

    if (modelOptions) {
      const authentication = call.request.params.authentication ?? requestedSchema.modelOptions.conduit.cms.authentication;
      const crudOperations = call.request.params.crudOperations ?? requestedSchema.modelOptions.conduit.cms.crudOperations;
      requestedSchema.modelOptions = merge(
        requestedSchema.modelOptions,
        modelOptions,
        { conduit: { cms: { enabled, authentication, crudOperations } } },
      );
    }

    const updatedSchema = await this.database
      .createSchemaFromAdapter(
        new ConduitSchema(
          requestedSchema.name,
          requestedSchema.fields,
          requestedSchema.modelOptions,
        )
      )
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    if (isNil(updatedSchema)) {
      throw new GrpcError(status.INTERNAL, 'Could not update schema');
    }

    // Mongoose requires that schemas are re-created in order to update them
    if (enabled) {
      await this.schemaController.createSchema(
        new ConduitSchema(
          updatedSchema.name,
          updatedSchema.fields,
          updatedSchema.modelOptions
        )
      );
    }

    return updatedSchema;
  }

  async deleteSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, deleteData } = call.request.params;

    const requestedSchema = await _DeclaredSchema.getInstance().findOne({
      ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
      _id: id,
    });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    // Temp: error out until Admin handles this case
    const endpoints = await CustomEndpoints.getInstance().findMany({
      selectedSchema: id,
    });
    if (!isNil(endpoints) && endpoints.length !== 0) {
      throw new GrpcError(
        status.ABORTED,
        'Cannot delete schema because it is used by a custom endpoint'
      );
    }

    await _DeclaredSchema.getInstance()
      .deleteOne(requestedSchema)
      .catch((e: any) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    await CustomEndpoints.getInstance()
      .deleteMany({ selectedSchema: id })
      .catch((e: any) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    const message = await this.database
      .deleteSchema(requestedSchema.name, deleteData)
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

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
        'Argument ids is required and must be a non-empty array!'
      );
    }

    const requestedSchemas = await _DeclaredSchema.getInstance().findMany({
        ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
        _id: { $in: ids },
    });
    if (isNil(requestedSchemas)) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }
    const foundSchemas = await _DeclaredSchema.getInstance().countDocuments({
      ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
      _id: { $in: ids },
    });
    if (foundSchemas !== requestedSchemas.length) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }

    for (let schema of requestedSchemas) {
      const endpoints = await CustomEndpoints.getInstance().countDocuments({
        selectedSchema: schema._id,
      });
      if (!isNil(endpoints) && endpoints > 0) {
        // Temp: error out until Admin handles this case
        throw new GrpcError(
          status.ABORTED,
          'Cannot delete schema because it is used by a custom endpoint'
        );
      }
      await this.database.deleteSchema(schema.name, deleteData).catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    }

    await _DeclaredSchema.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: any) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
    await CustomEndpoints.getInstance()
      .deleteMany({ selectedSchema: { $in: ids } })
      .catch((e: any) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return 'Schemas successfully deleted';
  }

  async toggleSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const requestedSchema = await _DeclaredSchema.getInstance().findOne({
      ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
      _id: call.request.params.id,
    });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    requestedSchema.modelOptions.conduit.cms.enabled =
      !requestedSchema.modelOptions.conduit.cms.enabled;

    const updatedSchema = await _DeclaredSchema.getInstance().findByIdAndUpdate(
      requestedSchema._id,
      requestedSchema
    );
    if (isNil(updatedSchema)) {
      throw new GrpcError(
        status.INTERNAL,
        `Could not ${
          requestedSchema.modelOptions.conduit.cms.enabled
          ? 'enable'
          : 'disable'
        } schema`
      );
    }
    await CustomEndpoints.getInstance()
      .updateMany(
        { selectedSchema: call.request.params.id },
        { enabled: requestedSchema.modelOptions.conduit.cms.enabled }
      )
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

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
        'Argument ids is required and must be a non-empty array!'
      );
    }

    const requestedSchemas = await _DeclaredSchema.getInstance().findMany({
      ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
      _id: { $in: ids },
    });
    if (isNil(requestedSchemas)) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }
    const foundDocumentsCount = await _DeclaredSchema.getInstance().countDocuments({
      ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
      _id: { $in: ids },
    });
    if (foundDocumentsCount !== requestedSchemas.length) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }

    const updatedSchemas = await _DeclaredSchema.getInstance().updateMany(
      {
        ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
        _id: { $in: ids }
      },
      { 'modelOptions.conduit.cms.enabled': enabled }
    );
    if (isNil(updatedSchemas)) {
      throw new GrpcError(
        status.INTERNAL,
        `Could not ${enabled ? 'enable' : 'disable'} schemas`
      );
    }

    await CustomEndpoints.getInstance()
      .updateMany({ selectedSchema: { $in: ids } }, { enabled: enabled })
      .catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });

    if (!enabled) {
      this.schemaController.refreshRoutes();
    }
    this.customEndpointController.refreshEndpoints();

    return {
      updatedSchemas,
      enabled,
    };
  }

  async setSchemaPerms(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let { id, extendable, canCreate, canModify, canDelete } = call.request.params;

    const requestedSchema = await _DeclaredSchema.getInstance().findOne({
      ownerModule: 'cms', name: { $nin: CMS_SYSTEM_SCHEMAS },
      _id: id,
    });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    this.patchSchemaPerms(
      requestedSchema,
      { extendable, canCreate, canModify, canDelete },
    );

    const updatedSchema = await _DeclaredSchema.getInstance().findByIdAndUpdate(
      requestedSchema._id,
      requestedSchema,
    );
    if (isNil(updatedSchema)) {
      throw new GrpcError(status.INTERNAL, 'Could not update schema permissions');
    }

    return 'Schema permissions updated successfully';
  }

  private patchSchemaPerms(
    schema: _DeclaredSchema,
    perms: ConduitModelOptions['permissions'],
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
