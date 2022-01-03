import ConduitGrpcSdk, {
  DatabaseProvider,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  GrpcError,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil, isString } from 'lodash';
import { ConfigController } from '../config/Config.controller';
import { IStorageProvider } from '../storage-provider';
import { _StorageContainer, _StorageFolder, File } from '../models';

export class FileHandlers {
  private readonly database: DatabaseProvider;
  private storageProvider: IStorageProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    storageProvider: IStorageProvider,
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
    const { name, data, folder, container, mimeType, isPublic } = call.request.params;
    let newFolder;
    if (isNil(folder)) {
      newFolder = '/';
    } else {
      newFolder = folder.trim().slice(-1) !== '/' ? folder.trim() + '/' : folder.trim();
    }
    let config = ConfigController.getInstance().config;
    let usedContainer = container;
    // the container is sent from the client
    if (isNil(usedContainer)) {
      usedContainer = config.defaultContainer;
    } else {
      let container = await _StorageContainer.getInstance().findOne({
        name: usedContainer,
      });
      if (!container) {
        if (!config.allowContainerCreation) {
          throw new GrpcError(status.PERMISSION_DENIED, 'Container creation is not allowed!');
        }
        let exists = await this.storageProvider.containerExists(usedContainer);
        if (!exists) {
          await this.storageProvider.createContainer(usedContainer);
        }
        await _StorageContainer.getInstance().create({
          name: usedContainer,
          isPublic,
        });
      }
    }
    let exists;
    if (!isNil(folder)) {
      exists = await this.storageProvider
        .container(usedContainer)
        .folderExists(newFolder);
      if (!exists) {
        await _StorageFolder.getInstance().create({
          name: newFolder,
          container: usedContainer,
          isPublic,
        });
        await this.storageProvider.container(usedContainer).createFolder(newFolder);
      }
    }

    exists = await File.getInstance().findOne({
      name,
      container: usedContainer,
      folder: newFolder,
    });
    if (exists) {
      throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
    }
    if (!isString(data)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid data provided');
    }

    try {
      const buffer = Buffer.from(data, 'base64');

      await this.storageProvider
        .container(usedContainer)
        .store((newFolder ?? '') + name, buffer);
      let publicUrl = null;
      if (isPublic) {
        publicUrl = await this.storageProvider
          .container(usedContainer)
          .getPublicUrl((newFolder ?? '') + name);
      }

      const newFile = await File.getInstance().create({
        name,
        mimeType,
        folder: newFolder,
        container: usedContainer,
        isPublic,
        url: publicUrl,
      });

      return newFile;
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message ?? 'Something went wrong');
    }
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
      const newFolder = folder ?? found.folder;
      const newContainer = container ?? found.container;

      const shouldRemove =
        newName !== found.name ||
        newContainer !== found.container ||
        newFolder !== found.folder;

      found.mimeType = mimeType ?? found.mimeType;

      if (newContainer !== found.container) {
        let container = await _StorageContainer.getInstance().findOne({
          name: newContainer,
        });
        if (!container) {
          if (!config.allowContainerCreation) {
            throw new GrpcError(status.PERMISSION_DENIED, 'Container creation is not allowed!');
          }
          let exists = await this.storageProvider.containerExists(newContainer);
          if (!exists) {
            await this.storageProvider.createContainer(newContainer);
          }
          await _StorageContainer.getInstance().create({ name: newContainer });
        }
      }

      if (newFolder !== found.folder) {
        let exists = await this.storageProvider
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

      let exists = await File.getInstance().findOne({
        name: name,
        container: newContainer,
        folder: newFolder,
      });
      if (exists) {
        throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
      }

      await this.storageProvider
        .container(newContainer)
        .store((newFolder ?? '') + name, fileData)

      if (shouldRemove) {
        await this.storageProvider
          .container(found.container)
          .delete((found.folder ?? '') + found.name);
      }

      found.name = newName;
      found.folder = newFolder;
      found.container = newContainer;
      const updatedFile = await File.getInstance().findByIdAndUpdate(found._id, found) as File;

      return updatedFile;
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

      if (!isNil(call.request.params.redirect) && (call.request.params.redirect === 'false' || !call.request.params.redirect)) {
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
      data.toString('base64');

      return { data: data.toString('base64') };
    } catch (e) {
      throw new GrpcError(status.INTERNAL, e.message ?? 'Something went wrong!');
    }
  }
}
