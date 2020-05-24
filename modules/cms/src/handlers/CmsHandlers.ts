import ConduitGrpcSdk from '@conduit/grpc-sdk';
import {isNil} from 'lodash';
import grpc from "grpc";

export class CmsHandlers {
    private database: any;

    constructor(private readonly grpcSdk: ConduitGrpcSdk) {
        this.initDb(grpcSdk);
    }

    private async initDb(grpcSdk: ConduitGrpcSdk) {
        await grpcSdk.waitForExistence('database-provider');
        this.database = grpcSdk.databaseProvider;
    }

    async getDocuments(call: any, callback: any) {
        const {skip, limit, schemaName} = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', {name: schemaName}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

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

        return callback(null, {result: JSON.stringify({documents, documentsCount})});
    }

    async getDocumentById(call: any, callback: any) {
        const {schemaName, id} = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', {name: schemaName}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested cms schema not found',
            });
        }


        const document = await this.database.findOne(schemaName, {_id: id}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(document)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested document not found',
            });
        }
        return callback(null, {result: JSON.stringify(document)});
    }

    async createDocument(call: any, callback: any) {
        const {schemaName, inputDocument} = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', {name: schemaName}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested cms schema not found',
            });
        }

        const newDocument = await this.database.create(schemaName, inputDocument).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: JSON.stringify(newDocument)});
    }

    async editDocument(call: any, callback: any) {
        const {schemaName, id, changedDocument} = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', {name: schemaName}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested cms schema not found',
            });
        }

        const dbDocument = await this.database.findOne(schemaName, {_id: id}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        Object.assign(dbDocument, changedDocument);

        const updatedDocument = await this.database.findByIdAndUpdate(schemaName, dbDocument).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: JSON.stringify(updatedDocument)});
    }

    async deleteDocument(call: any, callback: any) {
        const {schemaName, id} = JSON.parse(call.request.params);

        let errorMessage: any = null;
        const schema = await this.database.findOne('SchemaDefinitions', {name: schemaName}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (isNil(schema)) {
            return callback({
                code: grpc.status.NOT_FOUND,
                message: 'Requested cms schema not found',
            });
        }

        await this.database.deleteOne(schemaName, {_id: id}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: 'Ok'});
    }
}

