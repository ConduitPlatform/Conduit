import {isString, isNil} from 'lodash';
import {IStorageProvider} from '@conduit/storage-provider';
import {v4 as uuid} from 'uuid';
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import * as grpc from 'grpc';

export class FileHandlers {
    private database: any;
    private storageProvider: IStorageProvider;

    constructor(private readonly grpcSdk: ConduitGrpcSdk, storageProvider: IStorageProvider) {
        this.initDb(grpcSdk, storageProvider);
    }

    async initDb(grpcSdk: ConduitGrpcSdk, storageProvider: IStorageProvider) {
        await grpcSdk.waitForExistence('database-provider');
        this.database = grpcSdk.databaseProvider;
        this.storageProvider = storageProvider;
    }

    updateProvider(storageProvider: IStorageProvider) {
        this.storageProvider = storageProvider;
    }

    async createFile(call: any, callback: any) {

        const {name, data, folder, mimeType} = JSON.parse(call.request.params);

        if (!isString(data)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'Invalid data provided'});
        }

        if (!isString(folder)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'No folder provided'});
        }

        const buffer = Buffer.from(data, 'base64');

        let errorMessage = null;
        await this.storageProvider.folder(folder).exists('')
            .then(exists => {
                if (!exists) {
                    return this.storageProvider.folder('').createFolder(folder);
                }
            })
            .then(() => {
                this.storageProvider.folder(folder).store(name, buffer);
            })
            .catch(e => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const newFile = await this.database.create('File', {
            name,
            mimeType,
            folder
        }).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: JSON.stringify(newFile)});
    }

    async getFile(call: any, callback: any) {
        const {id} = JSON.parse(call.request.params);
        if (!isString(id)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'The provided id is invalid'});
        }

        let errorMessage = null;
        const result = await this.database.findOne('File', {_id: id})
            .then((found: any) => {
                if (isNil(found)) {
                    throw new Error('File not found');
                }
                return {file: this.storageProvider.folder(found.folder).get(found.name), found};
            })
            .then((obj: any) => {
                let data;
                if (Buffer.isBuffer(obj.file)) {
                    data = obj.file.toString('base64');
                } else {
                    data = Buffer.from(obj.file.toString()).toString('base64');
                }

                return {...obj.found, data};
            })
            .catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: JSON.stringify(result)});
    }

    async deleteFile(call: any, callback: any) {
        const {id} = JSON.parse(call.request.params);
        if (!isString(id)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'The provided id is invalid'});
        }

        let errorMessage = null;
        this.database.findOne('File', {_id: id})
            .then((found: any) => {
                if (isNil(found)) {
                    throw new Error('File not found');
                }
                return this.storageProvider.folder(found.folder).delete(found.name);
            })
            .then((success: boolean) => {
                if (!success) {
                    throw new Error('Error deleting the file');
                }
                return this.database.deleteOne('File', {_id: id});
            })
            .catch((e: any) => errorMessage = e.message);

        return callback(null, {result: JSON.stringify({success: true})});
    }

    async updateFile(call: any, callback: any) {
        const {id, data, name, folder, mimeType} = JSON.parse(call.request.params);
        if (!isString(id)) {
            return callback({code: grpc.status.INVALID_ARGUMENT, message: 'The provided id is invalid'});
        }

        let errorMessage = null;
        const found = await this.database.findOne('File', {_id: id}).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        if (isNil(found)) {
            return callback({code: grpc.status.NOT_FOUND, message: errorMessage});
        }

        // Create temporary file to make the changes so the original is not corrupted if anything fails
        const tempFileName = uuid();
        const oldData = await this.storageProvider.folder(found.folder).get(found.name)
            .catch(error => {
                errorMessage = 'Error reading file';
            });
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        const exists = await this.storageProvider.folder('temp').exists('').catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (!exists) {
            await this.storageProvider.folder('temp').createFolder('').catch((e: any) => errorMessage = e.message);
            if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
        }

        await this.storageProvider.folder('temp').store(tempFileName, oldData)
            .catch(error => {
                console.log(error);
                errorMessage = 'I/O Error';
            });
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        let failed = false;

        if (!isNil(data)) {
            const buffer = Buffer.from(data, 'base64');
            await this.storageProvider.folder('temp').store(tempFileName, buffer)
                .catch(error => {
                    failed = true;
                });
        }

        const newName = name ?? found.name;
        const newFolder = folder ?? found.folder;

        const shouldRemove = newName !== found.name;

        found.mimeType = mimeType ?? found.mimeType;

        // Commit the changes to the actual file if everything is successful
        if (failed) {
            await this.storageProvider.folder('temp').delete(tempFileName).catch((e: any) => errorMessage = e.message);
            if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
            return callback({code: grpc.status.INTERNAL, message: ''});
        }
        await this.storageProvider.folder('temp').moveToFolderAndRename(tempFileName, newName, newFolder)
            .catch(error => {
                errorMessage = 'I/O Error';
            });
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        if (shouldRemove) {
            await this.storageProvider.folder(found.folder).delete(found.name).catch((e: any) => errorMessage = e.message);
            if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});
            ;
        }

        found.name = newName;
        found.folder = newFolder;

        const updatedFile = await this.database.findByIdAndUpdate('File', found).catch((e: any) => errorMessage = e.message);
        if (!isNil(errorMessage)) return callback({code: grpc.status.INTERNAL, message: errorMessage});

        return callback(null, {result: JSON.stringify(updatedFile)});
    }
}
