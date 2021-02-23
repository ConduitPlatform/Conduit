import { IStorageProvider, StorageConfig } from "../../interfaces";
import {
  BlobSASPermissions,
  BlobSASSignatureValues,
  BlobServiceClient,
  SASProtocol,
} from "@azure/storage-blob";
import fs from "fs";

export class AzureStorage implements IStorageProvider {
  _activeContainer: string = "";
  private _storage: BlobServiceClient;

  constructor(options: StorageConfig) {
    this._storage = BlobServiceClient.fromConnectionString(
      options.azure.connectionString
    );
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

  async folderExists(name: string): Promise<boolean | Error> {
    let exists = await this._storage.getContainerClient(name).exists();
    return exists;
  }

  async delete(fileName: string): Promise<boolean | Error> {
    await this._storage
      .getContainerClient(this._activeContainer)
      .getBlockBlobClient(fileName)
      .deleteIfExists();
    return true;
  }

  async exists(fileName: string): Promise<boolean | Error> {
    let folderExists = await this._storage
      .getContainerClient(this._activeContainer)
      .exists();
    if (!folderExists) return false;
    await this._storage
      .getContainerClient(this._activeContainer)
      .getBlockBlobClient(fileName)
      .exists();
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
    let promise = await this._storage
      .getContainerClient(this._activeContainer)
      .getBlockBlobClient(fileName)
      .download(0);
    let data: Buffer = await this.streamToBuffer(promise.readableStreamBody);
    if (downloadPath) {
      fs.writeFileSync(downloadPath, data);
    }
    return data;
  }

  async getSignedUrl(fileName: string): Promise<any | Error> {
    let containerClient = this._storage.getContainerClient(
      this._activeContainer
    );
    const sasOptions: BlobSASSignatureValues = {
      containerName: containerClient.containerName,
      blobName: fileName,
      expiresOn: new Date(new Date().valueOf() + 3600 * 1000),
      permissions: BlobSASPermissions.parse("r"),
    };
    return containerClient.getBlobClient(fileName).generateSasUrl(sasOptions);
  }

  async getPublicUrl(fileName: string): Promise<any | Error> {
    let containerClient = this._storage.getContainerClient(
      this._activeContainer
    );
    const sasOptions: BlobSASSignatureValues = {
      containerName: containerClient.containerName,
      blobName: fileName,
      protocol: SASProtocol.Https,
      expiresOn: new Date(
        new Date().setFullYear(new Date().getFullYear() + 99)
      ),
      permissions: BlobSASPermissions.parse("r"),
    };

    return containerClient.getBlobClient(fileName).generateSasUrl(sasOptions);
  }

  async store(
    fileName: string,
    data: any,
    isPublic: boolean = false
  ): Promise<boolean | Error> {
    await this._storage
      .getContainerClient(this._activeContainer)
      .getBlockBlobClient(fileName)
      .upload(data, Buffer.byteLength(data));
    return true;
  }

  async rename(
    currentFilename: string,
    newFilename: string
  ): Promise<boolean | Error> {
    // await this._storage.getContainerClient(this._activeContainer).getBlockBlobClient(currentFilename).move(newFilename);
    // return true;
    throw new Error("Not Implemented yet!");
  }

  async moveToFolder(
    filename: string,
    newFolder: string
  ): Promise<boolean | Error> {
    // let newBucketFile = this._storage.getContainerClient(newFolder).file(filename)
    // await this._storage.getContainerClient(this._activeContainer).file(filename).move(newBucketFile);
    // return true;
    throw new Error("Not Implemented yet!");
  }

  async moveToFolderAndRename(
    currentFilename: string,
    newFilename: string,
    newFolder: string
  ): Promise<boolean | Error> {
    // let newBucketFile = this._storage.getContainerClient(newFolder).file(newFilename)
    // await this._storage.getContainerClient(this._activeContainer).file(currentFilename).move(newBucketFile);
    // return true;
    throw new Error("Not Implemented yet!");
  }
}
