import ConduitGrpcSdk, {
  ConduitSchema,
  DatabaseProvider,
  RouterRequest,
  RouterResponse,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { validateSchemaInput } from '../utils/utilities';
import { CustomEndpoints, SchemaDefinitions } from '../models';
import { SchemaController } from '../controllers/cms/schema.controller';
import { CustomEndpointController } from '../controllers/customEndpoints/customEndpoint.controller';

export class SchemaAdmin {
  private database: DatabaseProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly schemaController: SchemaController,
    private readonly customEndpointController: CustomEndpointController
  ) {
    this.database = this.grpcSdk.databaseProvider!;
  }

  async getAllSchemas(call: RouterRequest, callback: RouterResponse) {
    const { skip, limit } = JSON.parse(call.request.params);
    let skipNumber = 0,
      limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const schemasPromise = SchemaDefinitions.getInstance()
      .findMany(
        {},
        undefined,
        skipNumber,
        limitNumber
      );
    const documentsCountPromise = SchemaDefinitions.getInstance().countDocuments({});

    let errorMessage: string | null = null;
    const [schemas, documentsCount] = await Promise.all([
      schemasPromise,
      documentsCountPromise,
    ]).catch((e) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    return callback(null, {
      result: JSON.stringify({ results: schemas, documentsCount }),
    });
  }

  async getSchemasRegisteredByOtherModules(
    call: RouterRequest,
    callback: RouterResponse
  ) {
    let errorMessage: string | null = null;
    const allSchemas = await this.database
      .getSchemas()
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    const schemasFromCMS = await SchemaDefinitions.getInstance()
      .findMany({})
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INTERNAL, message: errorMessage });
    }

    const schemaNamesFromCMS = (schemasFromCMS as SchemaDefinitions[]).map((schema: any) => schema.name);
    const schemasFromOtherModules = allSchemas.filter((schema: any) => {
      return !schemaNamesFromCMS.includes(schema.name);
    });

    return callback(null, {
      result: JSON.stringify({
        results: schemasFromOtherModules.map((schema: any) => {
          return { name: schema.name, fields: schema.modelSchema };
        }),
      }),
    });
  }

  async getById(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);
    if (isNil(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Path parameter "id" is missing',
      });
    }

    let errorMessage = null;
    const requestedSchema = await SchemaDefinitions.getInstance()
      .findOne({ _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(requestedSchema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested resource not found',
      });
    }

    return callback(null, { result: JSON.stringify(requestedSchema) });
  }

  async createSchema(call: RouterRequest, callback: RouterResponse) {
    const {
      name,
      fields,
      modelOptions,
      enabled,
      authentication,
      crudOperations,
    } = JSON.parse(call.request.params);

    if (isNil(name) || isNil(fields)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Required fields are missing',
      });
    }

    if (name.indexOf('-') >= 0 || name.indexOf(' ') >= 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Names cannot include spaces and - characters',
      });
    }

    const errorMessage = validateSchemaInput(name, fields, modelOptions, enabled);
    if (!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }

    Object.assign(fields, {
      _id: TYPE.ObjectId,
      createdAt: TYPE.Date,
      updatedAt: TYPE.Date,
    });
    let options = undefined;
    if (!isNil(modelOptions)) options = JSON.stringify(modelOptions);

    let error = null;
    const allSchemas = await this.database
      .getSchemas()
      .catch((e: Error) => (error = e.message));
    if (!isNil(error)) {
      return callback({ code: status.INTERNAL, message: error });
    }

    let nameExists = allSchemas.filter((schema: any) => {
      return schema.name === name;
    });

    if (nameExists && nameExists.length !== 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Schema already exists!',
      });
    }

    error = null;
    const newSchema = await SchemaDefinitions.getInstance()
      .create({
        name,
        fields,
        modelOptions: options,
        enabled: isNil(enabled) ? true : enabled,
        authentication,
        crudOperations: crudOperations !== null ? crudOperations : true,
      })
      .catch((e: any) => (error = e));
    if (!isNil(error))
      return callback({
        code: status.INTERNAL,
        message: error,
      });

    if (!isNil(modelOptions)) newSchema.modelOptions = JSON.parse(newSchema.modelOptions);
    if (newSchema.enabled) {
      this.schemaController.createSchema(
        new ConduitSchema(newSchema.name, newSchema.fields, newSchema.modelOptions)
      );
    }

    return callback(null, { result: JSON.stringify(newSchema) });
  }

  async toggle(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);
    if (isNil(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Path parameter "id" is missing',
      });
    }
    let errorMessage = null;
    const requestedSchema = await SchemaDefinitions.getInstance()
      .findOne({ _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(requestedSchema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested schema not found',
      });
    }

    requestedSchema.enabled = !requestedSchema.enabled;
    this.schemaController.createSchema(
      new ConduitSchema(
        requestedSchema.name,
        requestedSchema.fields,
        requestedSchema.modelOptions
      )
    );

    const updatedSchema = await SchemaDefinitions.getInstance()
      .findByIdAndUpdate(requestedSchema._id, requestedSchema)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    await CustomEndpoints.getInstance()
      .updateMany(
        { selectedSchema: id },
        { enabled: requestedSchema.enabled }
      )
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return callback(null, {
      result: JSON.stringify({
        name: updatedSchema.name,
        enabled: updatedSchema.enabled,
      }),
    });
  }

  async editSchema(call: RouterRequest, callback: RouterResponse) {
    const { id, name, fields, modelOptions, authentication, crudOperations } = JSON.parse(
      call.request.params
    );
    if (isNil(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Path parameter "id" is missing',
      });
    }

    if (!isNil(name) && name !== '') {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Name of existing schema cannot be edited',
      });
    }

    let errorMessage = null;
    const requestedSchema = await SchemaDefinitions.getInstance()
      .findOne({ _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(requestedSchema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested schema not found',
      });
    }

    errorMessage = validateSchemaInput(name, fields, modelOptions);
    if (!isNil(errorMessage)) {
      return callback({
        code: status.INTERNAL,
        message: errorMessage,
      });
    }

    // if (Object.keys(requestedSchema.fields).length > Object.keys(fields).length) {
    //   return callback({
    //     code: status.INVALID_ARGUMENT,
    //     message: 'Schema fields may not be deleted...yet',
    //   });
    // }

    requestedSchema.name = name ? name : requestedSchema.name;
    requestedSchema.fields = fields ? fields : requestedSchema.fields;
    requestedSchema.modelOptions = modelOptions
      ? JSON.stringify(modelOptions)
      : requestedSchema.modelOptions;
    requestedSchema.authentication =
      authentication !== null ? authentication : requestedSchema.authentication;
    requestedSchema.crudOperations =
      crudOperations !== null ? crudOperations : requestedSchema.crudOperations;

    const updatedSchema = await SchemaDefinitions.getInstance()
      .findByIdAndUpdate(requestedSchema._id, requestedSchema)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (!isNil(updatedSchema.modelOptions))
      updatedSchema.modelOptions = JSON.parse(updatedSchema.modelOptions);

    // Mongoose requires that schemas are re-created in order to update them
    if (updatedSchema.enabled) {
      this.schemaController.createSchema(
        new ConduitSchema(
          updatedSchema.name,
          updatedSchema.fields,
          updatedSchema.modelOptions
        )
      );
    }

    return callback(null, { result: JSON.stringify(updatedSchema) });
  }

  async deleteSchema(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);
    if (isNil(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Path parameter "id" is missing',
      });
    }

    let errorMessage = null;
    const requestedSchema = await SchemaDefinitions.getInstance()
      .findOne({ _id: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    if (isNil(requestedSchema)) {
      return callback({
        code: status.NOT_FOUND,
        message: 'Requested schema not found',
      });
    }

    // TODO temporarily errorring out until Admin handles this case
    const endpoints = await CustomEndpoints.getInstance()
      .findMany({ selectedSchema: id })
      .catch((e: Error) => (errorMessage = e.message));
    if (!isNil(errorMessage)) {
      return callback({ code: status.INVALID_ARGUMENT, message: errorMessage });
    }

    if (!isNil(endpoints) && endpoints.length !== 0) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Can not delete schema because it is used by a custom endpoint',
      });
    }

    await SchemaDefinitions.getInstance()
      .deleteOne(requestedSchema)
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    await CustomEndpoints.getInstance()
      .deleteMany({ selectedSchema: id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: status.INTERNAL, message: errorMessage });

    this.schemaController.refreshRoutes();
    this.customEndpointController.refreshEndpoints();
    return callback(null, { result: 'Schema successfully deleted' });
  }
}
