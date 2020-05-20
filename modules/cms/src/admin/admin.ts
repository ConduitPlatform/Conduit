import ConduitGrpcSdk, { ConduitSchema, TYPE } from '@conduit/grpc-sdk';
import { isNil } from 'lodash';
import { validateSchemaInput } from '../utils/utilities';
import path from "path";
import grpc from "grpc";
const protoLoader = require('@grpc/proto-loader');

export class AdminHandlers {
  private readonly _createSchema: (schema: ConduitSchema) => void;
  private readonly database: any;

  constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk, createSchema: (schema: ConduitSchema) => void) {
    this.database = this.grpcSdk.databaseProvider;
    this._createSchema = createSchema;

    let packageDefinition = protoLoader.loadSync(
      path.resolve(__dirname, './admin.proto'),
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );
    let protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    let admin = protoDescriptor.cms.admin.Admin;
    server.addService(admin.service, {
      getAllSchemas: this.getAllSchemas.bind(this),
      getById: this.getById.bind(this),
      createSchema: this.createSchema.bind(this),
      toggle: this.toggle.bind(this),
      editSchema: this.editSchema.bind(this),
      deleteSchema: this.deleteSchema.bind(this)
    });

  }

  async getAllSchemas(call: any, callback: any) {
    const { skip, limit } = JSON.parse(call.request.params);
    let skipNumber = 0, limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const schemasPromise = this.database.findMany('SchemaDefinitions', {}, null, skipNumber, limitNumber);
    const documentsCountPromise = this.database.countDocuments('SchemaDefinitions', {});

    let errorMessage: string | null = null;
    const [schemas, documentsCount] = await Promise.all([schemasPromise, documentsCountPromise]).catch(e => errorMessage = e.message);
    if (!isNil(errorMessage)) return callback({
      code: grpc.status.INTERNAL,
      message: errorMessage,
    });

    return callback(null, {result: JSON.stringify({results: schemas, documentsCount})});
  }

  async getById(call: any, callback: any) {
    const { id } = JSON.parse(call.request.params);
    if (isNil(id)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Path parameter "id" is missing'
      });
    }

    const requestedSchema = await this.database.findOne('SchemaDefinitions', {_id: id});

    if (isNil(requestedSchema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested resource not found'
      });
    }

    return callback(null, {result: JSON.stringify(requestedSchema)});
  }

  async createSchema(call: any, callback: any) {
    const { name, fields, modelOptions, enabled } = JSON.parse(call.request.params);

    if (isNil(name) || isNil(fields)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Required fields are missing'
      });
    }

    const errorMessage = validateSchemaInput(name, fields, modelOptions, enabled);
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });
    }

    Object.assign(fields, {
      _id: TYPE.ObjectId,
      createdAt: TYPE.Date,
      updatedAt: TYPE.Date
    });
    let options = undefined;
    if (!isNil(modelOptions)) options = JSON.stringify(modelOptions);

    let error = null;
    const newSchema = await this.database.create('SchemaDefinitions', {name, fields, modelOptions: options, enabled}).catch((e: any)=> error = e);
    if (!isNil(error)) return callback({
      code: grpc.status.INTERNAL,
      message: error,
    });

    if (!isNil(modelOptions)) newSchema.modelOptions = JSON.parse(newSchema.modelOptions);
    if (newSchema.enabled) {
      this._createSchema(new ConduitSchema(newSchema.name, newSchema.fields, newSchema.modelOptions));
    }

    return callback(null, {result: JSON.stringify(newSchema)})
  }

  async toggle(call: any, callback: any) {
    const { id } = JSON.parse(call.request.params);
    if (isNil(id)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Path parameter "id" is missing'
      });
    }
    const requestedSchema = await this.database.findOne('SchemaDefinitions',{_id: id});

    if (isNil(requestedSchema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested schema not found'
      });
    }

    if (requestedSchema.enabled) {
      requestedSchema.enabled = false;
      // TODO disable routes
    } else {
      requestedSchema.enabled = true;
      this._createSchema(new ConduitSchema(requestedSchema.name, requestedSchema.fields, requestedSchema.modelOptions));
    }

    const updatedSchema = await this.database.findByIdAndUpdate('SchemaDefinitions',requestedSchema);

    return callback(null, {result: JSON.stringify({name: updatedSchema.name, enabled: updatedSchema.enabled})});
  }

  async editSchema(call: any, callback: any) {
    const { id, name, fields, modelOptions } = JSON.parse(call.request.params);
    if (isNil(id)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Path parameter "id" is missing'
      });
    }
    const requestedSchema = await this.database.findOne('SchemaDefinitions',{_id: id});

    if (isNil(requestedSchema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested schema not found'
      });
    }

    const errorMessage = validateSchemaInput(name, fields, modelOptions);
    if (!isNil(errorMessage)) {
      return callback({
        code: grpc.status.INTERNAL,
        message: errorMessage,
      });
    }

    requestedSchema.name = name ? name : requestedSchema.name;
    requestedSchema.fields = fields ? fields : requestedSchema.fields;
    requestedSchema.modelOptions = modelOptions ? JSON.stringify(modelOptions) : requestedSchema.modelOptions;

    const updatedSchema = await this.database.findByIdAndUpdate('SchemaDefinitions',requestedSchema);
    if (!isNil(updatedSchema.modelOptions)) updatedSchema.modelOptions = JSON.parse(updatedSchema.modelOptions);

    // TODO reinitialise routes?
    if (updatedSchema.enabled) {
      this._createSchema(new ConduitSchema(updatedSchema.name, updatedSchema.fields, updatedSchema.modelOptions));
    }
    // TODO even if new routes are initiated the old ones don't go anywhere so the user requests to those routes expect values compatible with the old schema

    return callback(null, {result: JSON.stringify(updatedSchema)});
  }

  async deleteSchema(call: any, callback: any) {
    const { id } = JSON.parse(call.request.params);
    if (isNil(id)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Path parameter "id" is missing'
      });
    }

    const requestedSchema = await this.database.findOne('SchemaDefinitions',{_id: id});
    if (isNil(requestedSchema)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested schema not found'
      });
    }

    await this.database.deleteOne('SchemaDefinitions', requestedSchema);

    // TODO disable routes
    return callback(null, {result: 'Schema successfully deleted'});
  }


  // calling constructNewRoute like:
  async test() {
    const newlyCreatedSchemaName = 'test';

    const path = {
      url: `/cms/content/${newlyCreatedSchemaName}`,
      method: 'GET',
      protoName: 'getSchemasDocuments'
    };

    const proto = `
      syntax = 'proto3';
      package = cms.admin;
      
      // all admin requests accept the params,headers and context objects as stringified json
      message AdminRequest {
        string params = 1;
        string headers = 2;
        string context = 3;
      }
      // all admin responses return their results as stringified json
      message AdminResponse {
        string result = 1;
      }
      
      service Admin {
        rpc GetSchemasDocuments(AdminRequest) returns (AdminResponse);
      }
    `


    await this.constructNewRoute(path, proto, 'moduleUrlHere');
  }

  private constructNewRoute(path: {url: string, method: string, protoName: string}, proto: string, moduleUrl: string) {
    return this.grpcSdk.admin.register([path], proto, moduleUrl).catch(console.log)
  }

  async getSchemasDocuments(call: any, callback: any) {
    const {schemaName, skip, limit} = JSON.parse(call.request.params);

    let skipNumber = 0, limitNumber = 25;

    if (!isNil(skip)) {
      skipNumber = Number.parseInt(skip as string);
    }
    if (!isNil(limit)) {
      limitNumber = Number.parseInt(limit as string);
    }

    const documents = await this.database.findMany(schemaName, {}, null, skipNumber, limitNumber);
    return callback(null, {result: JSON.stringify(documents)});
  }

}
