import ConduitGrpcSdk, {
  ConfigController,
  DatabaseProvider,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil, isString } from 'lodash';
import { IStorageProvider } from '../storage-provider';
import { _StorageContainer, _StorageFolder, File } from '../models';
import path from "path";
import fs from "fs";

export class FileHandlers {
  private readonly database: DatabaseProvider;
  private storageProvider: IStorageProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    storageProvider: IStorageProvider
  ) {
    this.database = this.grpcSdk.databaseProvider!;
    _StorageContainer.getInstance(this.database);
    _StorageFolder.getInstance(this.database);
    File.getInstance(this.database);
    this.storageProvider = storageProvider;
  }

  get storage() {
    return this.storageProvider;
  }

  updateProvider(storageProvider: IStorageProvider) {
    this.storageProvider = storageProvider;
  }

  async getFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const file = await File.getInstance().findOne({ _id: call.request.params.id });
    if (isNil(file)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    return file;
  }

  async createFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, data, mimeType } = call.request.params;
    const { folder, container, isPublic } = await this.getFileParams(call);

    if (!isString(data)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid data provided');
    }

    try {
      const buffer = Buffer.from(data, 'base64');

      await this.storageProvider
        .container(container)
        .store((folder ?? '') + name, buffer, isPublic);
      let publicUrl = null;
      if (isPublic) {
        publicUrl = await this.storageProvider
          .container(container)
          .getPublicUrl((folder ?? '') + name);
      }

      const newFile = await File.getInstance().create({
        name,
        mimeType,
        folder,
        container,
        isPublic,
        url: publicUrl,
      });

      return newFile;
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message ?? 'Something went wrong');
    }
  }

  // async uploadFile(call: any): Promise<UnparsedRouterResponse> { // TODO: Type this
  async uploadFile(call: any) {
    const fileUploadsPath = path.resolve(__dirname, '..', 'uploads');
    if (!fs.existsSync(fileUploadsPath)) {
      fs.mkdir(fileUploadsPath, (err) => {
        if (err) throw err; // TODO: Create this outside handler or throw GrpcError
      });
    }
    let writeStream: fs.WriteStream;
    let filePath = '';
    let mimeType = '';
    call.on('data', (data: any) => { // TODO: type
      console.log(data);
      if (data.info) {
        filePath = path.resolve(fileUploadsPath, data.info.name);
        mimeType = data.info.mimeType;
        writeStream = fs.createWriteStream(filePath);
      } else {
        writeStream.write(data.chunk);
      }
    })
    call.on('end', async () => {
      writeStream.close();
      console.log('BIG SUCKESS');
      return {
        id: '',
        url: '',
        name: 'BIG SUCCESS',
      };
    });



    // const { folder, container, isPublic } = await this.getFileParams(call);
    // const files = call.request.context.files;
    // for (const fileField of Object.keys(files)) {
    //   const { fileName } = files[fileField];
    //   const exists = await File.getInstance().findOne({ name: fileName, container, folder });
    //   if (exists) {
    //     // TODO: Generated files could have identical names, we should offer a way to rename ??
    //     throw new GrpcError(
    //       status.ALREADY_EXISTS,
    //       `File path already exists: ${container}/${folder}/${fileName}`,
    //     );
    //   }
    // }
    // const successful: string[] = [];
    // for (const fileField of Object.keys(files)) {
    //   const { fileName, mimeType } = files[fileField];
    //   await File.getInstance()
    //     .create({
    //       name: fileName,
    //       mimeType,
    //       folder,
    //       container,
    //       isPublic,
    //     })
    //     .catch(async e => {
    //       await File.getInstance().deleteMany({ name: { $in: successful } }).catch();
    //       throw new GrpcError(status.INTERNAL, e.message);
    //     });
    //   successful.push(fileName)
    // }
    // return `Uploading files: ${successful}`;




    // Post-Handler:
    // Upload data to provider
    // Add url (if public)
    // Upload data in a callback or sth
    //
    // try {
    //   const buffer = Buffer.from(data, 'base64');
    //
    //   await this.storageProvider
    //     .container(usedContainer)
    //     .store((newFolder ?? '') + name, buffer, isPublic);
    //   let publicUrl = null;
    //   if (isPublic) {
    //     publicUrl = await this.storageProvider
    //       .container(usedContainer)
    //       .getPublicUrl((newFolder ?? '') + name);
    //   }
    //
  }

  async updateFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, data, name, container, folder, mimeType } = call.request.params;
    try {
      const found = await File.getInstance().findOne({ _id: id });
      if (isNil(found)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
      let config = ConfigController.getInstance().config;
      let fileData = await this.storageProvider
        .container(found.container)
        .get((found.folder ?? '') + found.name);

      if (!isNil(data)) {
        fileData = Buffer.from(data, 'base64');
      }

      const newName = name ?? found.name;
      let newFolder = folder ?? found.folder;
      if (!newFolder.endsWith('/')) {
        // existing folder names are currently suffixed by "/" upon creation
        newFolder += '/';
      }
      const newContainer = container ?? found.container;

      const isDataUpdate =
        newName === found.name &&
        newContainer === found.container &&
        newFolder === found.folder;

      found.mimeType = mimeType ?? found.mimeType;

      if (newContainer !== found.container) {
        const container = await _StorageContainer.getInstance().findOne({
          name: newContainer,
        });
        if (!container) {
          if (!config.allowContainerCreation) {
            throw new GrpcError(
              status.PERMISSION_DENIED,
              'Container creation is not allowed!'
            );
          }
          const exists = await this.storageProvider.containerExists(newContainer);
          if (!exists) {
            await this.storageProvider.createContainer(newContainer);
          }
          await _StorageContainer.getInstance().create({ name: newContainer });
        }
      }

      if (newFolder !== found.folder) {
        const exists = await this.storageProvider
          .container(newContainer)
          .folderExists(newFolder);
        if (!exists) {
          await _StorageFolder.getInstance().create({
            name: newFolder,
            container: newContainer,
          });
          await this.storageProvider.container(newContainer).createFolder(newFolder);
        }
      }

      const exists = await File.getInstance().findOne({
        name: newName,
        container: newContainer,
        folder: newFolder,
      });
      if (!isDataUpdate && exists) {
        throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
      }

      await this.storageProvider
        .container(newContainer)
        .store((newFolder ?? '') + newName, fileData);
      // calling delete after store call succeeds
      if (!isDataUpdate) {
        await this.storageProvider
          .container(found.container)
          .delete((found.folder ?? '') + found.name);
      }

      await this.storageProvider
        .container(newContainer)
        .store((newFolder ?? '') + newName, fileData);

      found.name = newName;
      found.folder = newFolder;
      found.container = newContainer;
      return (await File.getInstance().findByIdAndUpdate(found._id, found)) as File;
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message ?? 'Something went wrong!');
    }
  }

  async deleteFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!isString(call.request.params.id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'The provided id is invalid');
    }
    try {
      let found = await File.getInstance().findOne({ _id: call.request.params.id });
      if (isNil(found)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
      let success = await this.storageProvider
        .container(found.container)
        .delete((found.folder ?? '') + found.name);
      if (!success) {
        throw new GrpcError(status.INTERNAL, 'File could not be deleted');
      }
      await File.getInstance().deleteOne({ _id: call.request.params.id });

      return { success: true };
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message ?? 'Something went wrong!');
    }
  }

  async getFileUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    try {
      const found = await File.getInstance().findOne({ _id: call.request.params.id });
      if (isNil(found)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
      if (found.isPublic) {
        return { redirect: found.url };
      }
      let url = await this.storageProvider
        .container(found.container)
        .getSignedUrl((found.folder ?? '') + found.name);

      if (!call.request.params.redirect) {
        return { result: url };
      }
      return { redirect: url };
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message ?? 'Something went wrong!');
    }
  }

  async getFileData(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!isString(call.request.params.id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'The provided id is invalid');
    }
    try {
      const file = await File.getInstance().findOne({ _id: call.request.params.id });
      if (isNil(file)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }

      let data: Buffer;
      if (file.folder) {
        data = await this.storageProvider
          .container(file.container)
          .get(file.folder + file.name);
      } else {
        data = await this.storageProvider.container(file.container).get(file.name);
      }

      return { data: data.toString('base64') };
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message ?? 'Something went wrong!');
    }
  }

  private async getFileParams(call: ParsedRouterRequest) {
    const config = ConfigController.getInstance().config;
    let folder = call.request.params.folder ? call.request.params.folder as string : undefined;
    let container = call.request.params.container ? call.request.params.container as string : undefined;
    const isPublic = !!call.request.params.isPublic;
    // Get / Create Container
    if (isNil(container)) {
      container = config.defaultContainer as string;
    } else {
      const foundContainer = await _StorageContainer.getInstance().findOne({
        name: container,
      });
      if (!foundContainer) {
        if (!config.allowContainerCreation) {
          throw new GrpcError(
            status.PERMISSION_DENIED,
            'Container creation is not allowed!'
          );
        }
        const exists = await this.storageProvider.containerExists(container);
        if (!exists) {
          await this.storageProvider.createContainer(container);
        }
        await _StorageContainer.getInstance().create({ name: container, isPublic });
      }
    }
    // Get / Create Folder
    folder = isNil(folder)
      ? '/'
      : folder.trim().slice(-1) !== '/'
        ? folder.trim() + '/'
        : folder.trim();
    let exists;
    if (!isNil(folder)) {
      exists = await this.storageProvider
        .container(container)
        .folderExists(folder);
      if (!exists) {
        await _StorageFolder.getInstance().create({
          name: folder,
          container: container,
          isPublic,
        });
        await this.storageProvider.container(container).createFolder(folder);
      }
    }
    return {
      folder,
      container,
      isPublic,
    };
  }
}
