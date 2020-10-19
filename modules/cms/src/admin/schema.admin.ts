import ConduitGrpcSdk, {ConduitSchema, TYPE} from "@quintessential-sft/conduit-grpc-sdk";
import {isNil} from "lodash";
import grpc from "grpc";
import {validateSchemaInput} from "../utils/utilities";
import {SchemaController} from "../controllers/schema.controller";

export class SchemaAdmin {

    private database: any;

    constructor(private readonly grpcSdk: ConduitGrpcSdk, private readonly schemaController: SchemaController) {
        this.database = this.grpcSdk.databaseProvider;
    }

    async getAllSchemas(call: any, callback: any) {
        const {skip, limit} = JSON.parse(call.request.params);
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
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: JSON.stringify({results: schemas, documentsCount})});
    }

    async getById(call: any, callback: any) {
        const {id} = JSON.parse(call.request.params);
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Path parameter "id" is missing'
            });
        }

        let errorMessage = null;
        const requestedSchema = await this.database.findOne('SchemaDefinitions', {_id: id}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(requestedSchema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested resource not found'
            });
        }

        return callback(null, {result: JSON.stringify(requestedSchema)});
    }

    async createSchema(call: any, callback: any) {
        const {name, fields, modelOptions, enabled} = JSON.parse(call.request.params);

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

        return callback(null, {result: JSON.stringify(newSchema)})
    }

    async toggle(call: any, callback: any) {
        const {id} = JSON.parse(call.request.params);
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Path parameter "id" is missing'
            });
        }
        let errorMessage = null;
        const requestedSchema = await this.database.findOne('SchemaDefinitions', {_id: id}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

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
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: JSON.stringify({name: updatedSchema.name, enabled: updatedSchema.enabled})});
    }

    async editSchema(call: any, callback: any) {
        const {id, name, fields, modelOptions} = JSON.parse(call.request.params);
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Path parameter "id" is missing'
            });
        }

        let errorMessage = null;
        const requestedSchema = await this.database.findOne('SchemaDefinitions', {_id: id}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

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
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (!isNil(updatedSchema.modelOptions)) updatedSchema.modelOptions = JSON.parse(updatedSchema.modelOptions);

        // Mongoose requires that schemas are re-created in order to update them
        if (updatedSchema.enabled) {
            this.schemaController.createSchema(new ConduitSchema(updatedSchema.name, updatedSchema.fields, updatedSchema.modelOptions));
        }
        // TODO reinitialise routes?
        // TODO even if new routes are initiated the old ones don't go anywhere so the user requests to those routes expect values compatible with the old schema

        return callback(null, {result: JSON.stringify(updatedSchema)});
    }

    async deleteSchema(call: any, callback: any) {
        const {id} = JSON.parse(call.request.params);
        if (isNil(id)) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'Path parameter "id" is missing'
            });
        }

        let errorMessage = null;
        const requestedSchema = await this.database.findOne('SchemaDefinitions', {_id: id}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(requestedSchema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested schema not found'
            });
        }

        await this.database.deleteOne('SchemaDefinitions', requestedSchema).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        this.schemaController.refreshRoutes();
        return callback(null, {result: 'Schema successfully deleted'});
    }

}