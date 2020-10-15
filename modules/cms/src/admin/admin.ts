import ConduitGrpcSdk, { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import { validateSchemaInput } from '../utils/utilities';
import path from "path";
import grpc from "grpc";
import { SchemaController } from "../controllers/schema.controller";

const protoLoader = require('@grpc/proto-loader');

export class AdminHandlers {
    private database: any;

    constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk, private readonly schemaController: SchemaController) {

        this.database = this.grpcSdk.databaseProvider;
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
            deleteSchema: this.deleteSchema.bind(this),
            getDocuments: this.getDocuments.bind(this),
            getDocumentById: this.getDocumentById.bind(this),
            createDocument: this.createDocument.bind(this),
            editDocument: this.editDocument.bind(this),
            deleteDocument: this.deleteDocument.bind(this),
            getCustomEndpoints: this.getCustomEndpoints.bind(this),
            createCustomEndpoints: this.createCustomEndpoints.bind(this),
            deleteCustomEndpoints: this.deleteCustomEndpoints.bind(this),
            editCustomEndpoints: this.editCustomEndpoints.bind(this)

        });

    }

    async getCustomEndpoints(call: any, callback: any) {
        let errorMessage: string | null = null;

        const customEndpointsDocs = await this.database.findMany('CustomEndpoints', {}, null, null, null).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
        return callback(null, { result: JSON.stringify({ results: customEndpointsDocs }) });
    }

    async editCustomEndpoints(call: any, callback: any) {
        const params = JSON.parse(call.request.params);
        const id = params.id;
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                      message: 'id must not be null'
               });
        }
        let errorMessage: string | null = null;
        delete params.id;
        const found = await this.database.findOne('CustomEndpoints', {
            _id: id
        }).catch((e: any) => errorMessage = e.message);

        if (isNil(found) || !isNil(errorMessage)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                      message: 'Schema not found'
               });
        }


        Object.keys(params).forEach(key => {
            const value = params[key];
            found[key] = value;
        });

        const updatedSchema = await this.database.findByIdAndUpdate
        ('CustomEndpoints' ,found._id, found  ).catch((e: any) =>
         errorMessage = e.message);

         if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
         return callback(null, { result: JSON.stringify(updatedSchema) });
    }

    
      

    
    async deleteCustomEndpoints(call: any, callback: any) {
        const { id } = JSON.parse(call.request.params);
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Id is missing'
            });
        }
        if (id.length === 0) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Id must not be empty'
            });
        }
        let errorMessage: any = null;
        const schema = await this.database.findOne('CustomEndpoints', { _id: id }).catch((e: any) => 
        errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
        
        
        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested schema not found',
            });
        }
        
        await this.database.deleteOne('CustomEndpoints', { _id: id }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });
        return callback(null, { result: 'Selected Schema is Deleted' });
    }

    async createCustomEndpoints(call: any, callback: any) {
        const { name, operation, selectedSchema, inputs, queries } = JSON.parse(call.request.params);

        if (isNil(name) || isNil(operation) || isNil(selectedSchema) ||
            isNil(inputs) || isNil(queries)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Required fields are missing'
            });
        }
        if (name.length === 0) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Name must not be empty'
            });
        }
        if (operation < 0 || operation > 3) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Operation is not valid'

            });
        }

        if (selectedSchema.length === 0) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'SelectedSchema must not be empty'
            });
        }
        let errorMessage: string | null = null;
        const findSchema = await this.database.findOne('SchemaDefinitions', {
            _id: selectedSchema
        }).catch((e: any) =>
            errorMessage = e.message);
        if (!isNil(errorMessage) || isNil(findSchema)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'SelectedSchema not found'
            });
        }

        // todo checks for inputs & queries

        errorMessage = null;
        const newSchema = await this.database.create('CustomEndpoints', {
            name,
            operation, selectedSchema, inputs, queries
        }).catch((e: any) =>
            errorMessage = e.message);
        if (!isNil(errorMessage)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Endpoint Creation failed'
            });
        }
        return callback(null, { result: JSON.stringify(newSchema) });
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
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        return callback(null, { result: JSON.stringify({ results: schemas, documentsCount }) });
    }

    async getById(call: any, callback: any) {
        const { id } = JSON.parse(call.request.params);
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Path parameter "id" is missing'
            });
        }

        let errorMessage = null;
        const requestedSchema = await this.database.findOne('SchemaDefinitions', { _id: id }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(requestedSchema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested resource not found'
            });
        }

        return callback(null, { result: JSON.stringify(requestedSchema) });
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
        const newSchema = await this.database.create('SchemaDefinitions', {
            name,
            fields,
            modelOptions: options,
            enabled
        }).catch((e: any) => error = e);
        if (!isNil(error)) return callback({
            code: grpc.status.INTERNAL,
            message: error,
        });

        if (!isNil(modelOptions)) newSchema.modelOptions = JSON.parse(newSchema.modelOptions);
        if (newSchema.enabled) {
            this.schemaController.createSchema(new ConduitSchema(newSchema.name, newSchema.fields, newSchema.modelOptions));
        }

        return callback(null, { result: JSON.stringify(newSchema) })
    }

    async toggle(call: any, callback: any) {
        const { id } = JSON.parse(call.request.params);
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Path parameter "id" is missing'
            });
        }
        let errorMessage = null;
        const requestedSchema = await this.database.findOne('SchemaDefinitions', { _id: id }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(requestedSchema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested schema not found'
            });
        }

        if (requestedSchema.enabled) {
            requestedSchema.enabled = false;
            this.schemaController.createSchema(new ConduitSchema(requestedSchema.name, requestedSchema.fields, requestedSchema.modelOptions));
        } else {
            requestedSchema.enabled = true;
            this.schemaController.createSchema(new ConduitSchema(requestedSchema.name, requestedSchema.fields, requestedSchema.modelOptions));
        }

        const updatedSchema = await this.database.findByIdAndUpdate('SchemaDefinitions', requestedSchema).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        return callback(null, { result: JSON.stringify({ name: updatedSchema.name, enabled: updatedSchema.enabled }) });
    }

    async editSchema(call: any, callback: any) {
        const { id, name, fields, modelOptions } = JSON.parse(call.request.params);
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Path parameter "id" is missing'
            });
        }

        let errorMessage = null;
        const requestedSchema = await this.database.findOne('SchemaDefinitions', { _id: id }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(requestedSchema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested schema not found'
            });
        }

        errorMessage = validateSchemaInput(name, fields, modelOptions);
        if (!isNil(errorMessage)) {
            return callback({
                code: grpc.status.INTERNAL,
                message: errorMessage,
            });
        }

        requestedSchema.name = name ? name : requestedSchema.name;
        requestedSchema.fields = fields ? fields : requestedSchema.fields;
        requestedSchema.modelOptions = modelOptions ? JSON.stringify(modelOptions) : requestedSchema.modelOptions;

        const updatedSchema = await this.database.findByIdAndUpdate('SchemaDefinitions', requestedSchema._id, requestedSchema).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (!isNil(updatedSchema.modelOptions)) updatedSchema.modelOptions = JSON.parse(updatedSchema.modelOptions);

        // Mongoose requires that schemas are re-created in order to update them
        if (updatedSchema.enabled) {
            this.schemaController.createSchema(new ConduitSchema(updatedSchema.name, updatedSchema.fields, updatedSchema.modelOptions));
        }
        // TODO reinitialise routes?
        // TODO even if new routes are initiated the old ones don't go anywhere so the user requests to those routes expect values compatible with the old schema

        return callback(null, { result: JSON.stringify(updatedSchema) });
    }

    async deleteSchema(call: any, callback: any) {
        const { id } = JSON.parse(call.request.params);
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Path parameter "id" is missing'
            });
        }

        let errorMessage = null;
        const requestedSchema = await this.database.findOne('SchemaDefinitions', { _id: id }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(requestedSchema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested schema not found'
            });
        }

        await this.database.deleteOne('SchemaDefinitions', requestedSchema).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        this.schemaController.refreshRoutes();
        return callback(null, { result: 'Schema successfully deleted' });
    }

    async getDocuments(call: any, callback: any) {
        const { skip, limit, schemaName } = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', { name: schemaName }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested cms schema not found',
            });
        }

        let skipNumber = 0, limitNumber = 25;

        if (!isNil(skip)) {
            skipNumber = Number.parseInt(skip as string);
        }
        if (!isNil(limit)) {
            limitNumber = Number.parseInt(limit as string);
        }

        const documentsPromise = this.database.findMany(schemaName, {}, null, skipNumber, limitNumber);
        const countPromise = this.database.countDocuments(schemaName, {});

        const [documents, documentsCount] = await Promise.all([documentsPromise, countPromise]).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) {
            return callback({
                code: grpc.status.INTERNAL,
                message: errorMessage,
            });
        }

        return callback(null, { result: JSON.stringify({ documents, documentsCount }) });
    }

    async getDocumentById(call: any, callback: any) {
        const { schemaName, id } = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', { name: schemaName }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested cms schema not found',
            });
        }


        const document = await this.database.findOne(schemaName, { _id: id }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(document)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested document not found',
            });
        }
        return callback(null, { result: JSON.stringify(document) });
    }

    async createDocument(call: any, callback: any) {
        const { schemaName, inputDocument } = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', { name: schemaName }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested cms schema not found',
            });
        }

        const newDocument = await this.database.create(schemaName, inputDocument).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        return callback(null, { result: JSON.stringify(newDocument) });
    }

    async editDocument(call: any, callback: any) {
        const { schemaName, id, changedDocument } = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', { name: schemaName }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested cms schema not found',
            });
        }

        const dbDocument = await this.database.findOne(schemaName, { _id: id }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        Object.assign(dbDocument, changedDocument);

        const updatedDocument = await this.database.findByIdAndUpdate(schemaName, dbDocument._id, dbDocument).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        return callback(null, { result: JSON.stringify(updatedDocument) });
    }

    async deleteDocument(call: any, callback: any) {
        const { schemaName, id } = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', { name: schemaName }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested cms schema not found',
            });
        }

        await this.database.deleteOne(schemaName, { _id: id }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({ code: grpc.status.INTERNAL, message: errorMessage });

        return callback(null, { result: 'Ok' });
    }
}
