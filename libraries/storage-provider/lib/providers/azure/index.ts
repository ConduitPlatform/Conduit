import {IStorageProvider, StorageConfig} from "../../interfaces";
import {BlobServiceClient} from '@azure/storage-blob';
import fs from 'fs';


export class AzureStorage implements IStorageProvider {

    private _storage: BlobServiceClient;
    _activeContainer: string = '';

    constructor(options: StorageConfig) {
        this._storage = BlobServiceClient.fromConnectionString(options.azure.connectionString);
    }

    /**
     * Used to create a new bucket
     * @param name For the bucket
     */
    async createFolder(name: string): Promise<boolean | Error> {
        // Creates the new bucket
        await this._storage.getContainerClient(name).create();
        this._activeContainer = name;
        return true;
    }

    /**
     * Used to switch the current bucket.
     * Ex. storage.bucket('photos').file('test')
     * @param name For the bucket
     */
    folder(name: string): IStorageProvider {
        this._activeContainer = name;
        return this;
    }

    async delete(fileName: string): Promise<boolean | Error> {
        await this._storage.getContainerClient(this._activeContainer).getBlockBlobClient(fileName).deleteIfExists();
        return true;
    }

    async exists(fileName: string): Promise<boolean | Error> {
        await this._storage.getContainerClient(this._activeContainer).getBlockBlobClient(fileName).exists();
        return true;
    }

    // A helper method used to read a Node.js readable stream into a Buffer
    async streamToBuffer(readableStream: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: any = [];
            readableStream.on("data", (data: any) => {
                chunks.push(data instanceof Buffer ? data : Buffer.from(data));
            });
            readableStream.on("end", () => {
                resolve(Buffer.concat(chunks));
            });
            readableStream.on("error", reject);
        });
    }

    async get(fileName: string, downloadPath?: string): Promise<any | Error> {
        let promise = await this._storage.getContainerClient(this._activeContainer).getBlockBlobClient(fileName).download(0);
        let data: Buffer = (await this.streamToBuffer(promise.readableStreamBody));
        if(downloadPath){
            fs.writeFileSync(downloadPath, data);
        }
        return data;
    }

    async getSignedUrl(fileName: string): Promise<any | Error> {
        this._storage.getContainerClient(this._activeContainer).getBlobClient(fileName)
            .generateSasUrl({
                permissions:{
                    read: true,
                    write:false,
                    add:false,
                    create:false,
                    delete:false,
                    deleteVersion: false,
                    tag:false,
                    move: false,
                    execute: false
                },
                expiresOn: new Date()
            })
            .then((r: any) => {
                if (r.data && r.data[0]) {
                    return r.data[0];
                }
                return r;
            })
    }

    async getPublicUrl(fileName: string): Promise<any | Error> {
        return  this._storage.getContainerClient(this._activeContainer).getBlockBlobClient(fileName).url;
    }

    async store(fileName: string, data: any, isPublic: boolean = false): Promise<boolean | Error> {
        await this._storage.getContainerClient(this._activeContainer).getBlockBlobClient(fileName).upload(data, Buffer.byteLength(data));
        return true;
    }

    async rename(currentFilename: string, newFilename: string): Promise<boolean | Error> {
        // await this._storage.getContainerClient(this._activeContainer).getBlockBlobClient(currentFilename).move(newFilename);
        // return true;
        throw new Error("Not Implemented yet!");
    }

    async moveToFolder(filename: string, newFolder: string): Promise<boolean | Error> {
        // let newBucketFile = this._storage.getContainerClient(newFolder).file(filename)
        // await this._storage.getContainerClient(this._activeContainer).file(filename).move(newBucketFile);
        // return true;
        throw new Error("Not Implemented yet!");
    }

    async moveToFolderAndRename(currentFilename: string, newFilename: string, newFolder: string): Promise<boolean | Error> {
        // let newBucketFile = this._storage.getContainerClient(newFolder).file(newFilename)
        // await this._storage.getContainerClient(this._activeContainer).file(currentFilename).move(newBucketFile);
        // return true;
        throw new Error("Not Implemented yet!");
    }

}
