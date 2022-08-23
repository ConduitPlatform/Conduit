import ConduitGrpcSdk, {
  ConfigController,
  DatabaseProvider,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil, isString } from 'lodash';
import { _StorageContainer, _StorageFolder, File } from '../models';
import { IStorageProvider } from '../interfaces';

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
    const config = ConfigController.getInstance().config;
    let usedContainer = container;
    // the container is sent from the client
    if (isNil(usedContainer)) {
      usedContainer = config.defaultContainer;
    } else {
      const container = await _StorageContainer.getInstance().findOne({
        name: usedContainer,
      });
      if (!container) {
        if (!config.allowContainerCreation) {
          throw new GrpcError(
            status.PERMISSION_DENIED,
            'Container creation is not allowed!',
          );
        }
        const exists = await this.storageProvider.containerExists(usedContainer);
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
        .store((newFolder ?? '') + name, buffer, isPublic);
      let publicUrl = null;
      if (isPublic) {
        publicUrl = await this.storageProvider
          .container(usedContainer)
          .getPublicUrl((newFolder ?? '') + name);
      }

      return await File.getInstance().create({
        name,
        mimeType,
        folder: newFolder,
        container: usedContainer,
        isPublic,
        url: publicUrl,
      });
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }

  async updateFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, data, name, container, folder, mimeType } = call.request.params;
    try {
      const found = await File.getInstance().findOne({ _id: id });
      if (isNil(found)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
      const config = ConfigController.getInstance().config;
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
              'Container creation is not allowed!',
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
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong!',
      );
    }
  }

  async deleteFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!isString(call.request.params.id)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'The provided id is invalid');
    }
    try {
      const found = await File.getInstance().findOne({ _id: call.request.params.id });
      if (isNil(found)) {
        throw new GrpcError(status.NOT_FOUND, 'File does not exist');
      }
      const success = await this.storageProvider
        .container(found.container)
        .delete((found.folder ?? '') + found.name);
      if (!success) {
        throw new GrpcError(status.INTERNAL, 'File could not be deleted');
      }
      await File.getInstance().deleteOne({ _id: call.request.params.id });

      return { success: true };
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong!',
      );
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
      const url = await this.storageProvider
        .container(found.container)
        .getSignedUrl((found.folder ?? '') + found.name);

      if (!call.request.params.redirect) {
        return { result: url };
      }
      return { redirect: url };
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong!',
      );
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
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong!',
      );
    }
  }
}
