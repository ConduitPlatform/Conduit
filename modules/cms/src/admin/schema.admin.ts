import ConduitGrpcSdk, {
  DatabaseProvider,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
  TYPE,
  ConduitSchema,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { validateSchemaInput } from '../utils/utilities';
import { SchemaController } from '../controllers/cms/schema.controller';
import { CustomEndpointController } from '../controllers/customEndpoints/customEndpoint.controller';
import { SchemaDefinitions, CustomEndpoints } from '../models';

const escapeStringRegexp = require('escape-string-regexp');

export class SchemaAdmin {
  private readonly database: DatabaseProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly schemaController: SchemaController,
    private readonly customEndpointController: CustomEndpointController,
  ) {
    this.database = this.grpcSdk.databaseProvider!;
  }

  async getSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const requestedSchema = await SchemaDefinitions.getInstance().findOne({ _id: call.request.params.id });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    return { requestedSchema };
  }

  async getManySchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip, limit, search, sort, enabled } = call.request.params;
    let skipNumber = 0, limitNumber = 25;
    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }
    let query: any = {}, identifier;
    if (!isNil(search)) {
      identifier = escapeStringRegexp(search);
      query['name'] = { $regex: `.*${identifier}.*`, $options: 'i' };
    }
    if (!isNil(enabled)) {
      query['enabled'] = enabled;
    }

    const schemasPromise = SchemaDefinitions.getInstance()
      .findMany(
        query,
        undefined,
        skipNumber,
        limitNumber,
        sort,
      );
    const documentsCountPromise = SchemaDefinitions.getInstance().countDocuments(query);

    const [schemas, documentsCount] = await Promise.all([
      schemasPromise,
      documentsCountPromise,
    ]).catch((e) => { throw new GrpcError(status.INTERNAL, e.message)});

    return { results: { schemas, documentsCount } }; // TODO: unnest (frontend compat)
  }

  async getManySchemasRegisteredByOtherModules(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const allSchemas = await this.database
      .getSchemas()
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    const schemasFromCMS = await SchemaDefinitions.getInstance().findMany({});
    const schemaNamesFromCMS = (schemasFromCMS as SchemaDefinitions[]).map((schema: SchemaDefinitions) => schema.name);
    const schemasFromOtherModules = allSchemas.filter((schema: any) => {
      return !schemaNamesFromCMS.includes(schema.name);
    });

    return {
      results: schemasFromOtherModules.map((schema: any) => { // TODO: unnest (frontend compat)
        return { name: schema.name, fields: schema.modelSchema };
      }),
    };
  }

  async createSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, fields, modelOptions, enabled, authentication, crudOperations } = call.request.params;

    if (name.indexOf('-') >= 0 || name.indexOf(' ') >= 0) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Names cannot include spaces and - characters');
    }
    const errorMessage = validateSchemaInput(name, fields, modelOptions, enabled);
    if (!isNil(errorMessage)) {
      throw new GrpcError(status.INVALID_ARGUMENT, errorMessage);
    }

    Object.assign(fields, {
      _id: TYPE.ObjectId,
      createdAt: TYPE.Date,
      updatedAt: TYPE.Date,
    });
    let options = undefined;
    if (!isNil(modelOptions)) options = JSON.stringify(modelOptions);

    const allSchemas = await this.database
      .getSchemas()
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    let nameExists = allSchemas.filter((schema: any) => {
      return schema.name === name;
    });
    if (nameExists && nameExists.length !== 0) {
      throw new GrpcError(status.ALREADY_EXISTS, 'Schema already exists!');
    }

    const newSchema = await SchemaDefinitions.getInstance()
      .create({
        name,
        fields,
        modelOptions: options,
        enabled: isNil(enabled) ? true : enabled,
        authentication,
        crudOperations: crudOperations !== null ? crudOperations : true,
      })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    if (newSchema.enabled) {
      this.schemaController.createSchema(
        new ConduitSchema(newSchema.name, newSchema.fields, newSchema.modelOptions),
      );
    }

    return { newSchema };
  }

  async editSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, name, fields, modelOptions, authentication, crudOperations } = call.request.params;

    if (!isNil(name) && name !== '') {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Name of existing schema cannot be edited');
    }

    const requestedSchema = await SchemaDefinitions.getInstance().findOne({ _id: id });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }
    const errorMessage = validateSchemaInput(name, fields, modelOptions);
    if (!isNil(errorMessage)) {
      throw new GrpcError(status.INTERNAL, errorMessage);
    }

    requestedSchema.name = name ? name : requestedSchema.name;
    requestedSchema.fields = fields ? fields : requestedSchema.fields;
    requestedSchema.modelOptions = modelOptions
      ? modelOptions
      : requestedSchema.modelOptions;
    requestedSchema.authentication =
      authentication !== null ? authentication : requestedSchema.authentication;
    requestedSchema.crudOperations =
      crudOperations !== null ? crudOperations : requestedSchema.crudOperations;

    const updatedSchema = await SchemaDefinitions.getInstance().findByIdAndUpdate(requestedSchema._id, requestedSchema);
    if (isNil(updatedSchema)) {
      throw new GrpcError(status.INTERNAL, 'Could not update schema');
    }

    // Mongoose requires that schemas are re-created in order to update them
    if (updatedSchema.enabled) {
      this.schemaController.createSchema(
        new ConduitSchema(
          updatedSchema.name,
          updatedSchema.fields,
          updatedSchema.modelOptions,
        ),
      );
    }

    return { updatedSchema };
  }

  async deleteSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, deleteData } = call.request.params;

    const requestedSchema = await SchemaDefinitions.getInstance().findOne({ _id: id });
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    // Temp: error out until Admin handles this case
    const endpoints = await CustomEndpoints.getInstance().findMany({ selectedSchema: id })
    if (!isNil(endpoints) && endpoints.length !== 0) {
      throw new GrpcError(status.ABORTED, 'Cannot delete schema because it is used by a custom endpoint');
    }

    await SchemaDefinitions.getInstance()
      .deleteOne(requestedSchema)
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    await CustomEndpoints.getInstance()
      .deleteMany({ selectedSchema: id })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    const message = await this.database
      .deleteSchema(requestedSchema.name, deleteData)
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return { message };
  }

  async deleteManySchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids, deleteData } = call.request.params;
    if (isNil(ids) || ids.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'Argument ids is required and must be a non-empty array!');
    }

    const requestedSchemas = await SchemaDefinitions.getInstance().findMany({ _id: { $in: ids } })
    if (isNil(requestedSchemas)) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }
    const foundSchemas = await SchemaDefinitions.getInstance().countDocuments({ _id: { $in: ids } })
    if (foundSchemas !== requestedSchemas.length) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }

    for (let schema of requestedSchemas) {
      const endpoints = await CustomEndpoints.getInstance().countDocuments({ selectedSchema: schema._id })
      if (!isNil(endpoints) && endpoints > 0) {
        // Temp: error out until Admin handles this case
        throw new GrpcError(status.ABORTED, 'Cannot delete schema because it is used by a custom endpoint');
      }
      await this.database
        .deleteSchema(schema.name, deleteData)
        .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });
    }

    await SchemaDefinitions.getInstance()
      .deleteMany({ _id: { $in: ids } })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });
    await CustomEndpoints.getInstance()
      .deleteMany({ selectedSchema: { $in: ids } })
      .catch((e: any) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return 'Schemas successfully deleted';
  }

  async toggleSchema(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const requestedSchema = await SchemaDefinitions.getInstance().findOne({ _id: call.request.params.id })
    if (isNil(requestedSchema)) {
      throw new GrpcError(status.NOT_FOUND, 'Schema does not exist');
    }

    requestedSchema.enabled = !requestedSchema.enabled;
    this.schemaController.createSchema(
      new ConduitSchema(
        requestedSchema.name,
        requestedSchema.fields,
        requestedSchema.modelOptions,
      ),
    );

    const updatedSchema = await SchemaDefinitions.getInstance().findByIdAndUpdate(requestedSchema._id, requestedSchema)
    if (isNil(updatedSchema)) {
      throw new GrpcError(status.INTERNAL, `Could not ${requestedSchema.enabled ? 'enable' : 'disable'} schema`);
    }
    await CustomEndpoints.getInstance()
      .updateMany(
        { selectedSchema: call.request.params.id },
        { enabled: requestedSchema.enabled },
      )
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return {
      name: updatedSchema.name,
      enabled: updatedSchema.enabled,
    };
  }

  async toggleManySchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { ids, enabled } = call.request.params;
    if (isNil(ids) || ids.length === 0) { // array check is required
      throw new GrpcError(status.INVALID_ARGUMENT, 'Argument ids is required and must be a non-empty array!');
    }

    const requestedSchemas = await SchemaDefinitions.getInstance().findMany({ _id: { $in: ids } });
    if (isNil(requestedSchemas)) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }
    const foundDocumentsCount = await SchemaDefinitions.getInstance().countDocuments({ _id: { $in: ids } });
    if (foundDocumentsCount !== requestedSchemas.length) {
      throw new GrpcError(status.NOT_FOUND, 'ids array contains invalid ids');
    }

    const updatedSchemas = await SchemaDefinitions.getInstance().updateMany({ _id: { $in: ids } }, { enabled: enabled });
    if (isNil(updatedSchemas)) {
      throw new GrpcError(status.INTERNAL, `Could not ${enabled ? 'enable' : 'disable'} schemas`);
    }

    await CustomEndpoints.getInstance()
      .updateMany({ selectedSchema: { $in: ids } }, { enabled: enabled })
      .catch((e: Error) => { throw new GrpcError(status.INTERNAL, e.message); });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return {
      updatedSchemas,
      enabled,
    };
  }
}
