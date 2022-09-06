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
    const usedContainer = isNil(container)
      ? config.defaultContainer
      : await this.findContainer(container, isPublic);
    if (!isNil(folder)) {
      await this.findFolder(newFolder, usedContainer, isPublic);
    }

    const exists = await File.getInstance().findOne({
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
      return this.storeNewFile(data, usedContainer, newFolder, isPublic, name, mimeType);
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
      found.mimeType = mimeType ?? found.mimeType;
      const isDataUpdate =
        newName === found.name &&
        newContainer === found.container &&
        newFolder === found.folder;

      if (newContainer !== found.container) {
        await this.findContainer(newContainer);
      }
      if (newFolder !== found.folder) {
        await this.findFolder(newFolder, newContainer);
      }

      const exists = await File.getInstance().findOne({
        name: newName,
        container: newContainer,
        folder: newFolder,
      });
      if (!isDataUpdate && exists) {
        throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
      }
      return this.storeUpdatedFile(
        newContainer,
        newFolder,
        newName,
        found,
        fileData,
        isDataUpdate,
      );
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
      ConduitGrpcSdk.Metrics?.decrement('files_total');
      ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', found.size);
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

  private async findContainer(container: string, isPublic?: boolean): Promise<string> {
    const config = ConfigController.getInstance().config;
    // the container is sent from the client
    const found = await _StorageContainer.getInstance().findOne({
      name: container,
    });
    if (!found) {
      if (!config.allowContainerCreation) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'Container creation is not allowed!',
        );
      }
      const exists = await this.storageProvider.containerExists(container);
      if (!exists) {
        await this.storageProvider.createContainer(container);
      }
      await _StorageContainer.getInstance().create({
        name: container,
        isPublic,
      });
    }
    return container;
  }

  private async findFolder(
    folder: string,
    container: string,
    isPublic?: boolean,
  ): Promise<void> {
    const exists = await this.storageProvider.container(container).folderExists(folder);
    if (!exists) {
      await _StorageFolder.getInstance().create({
        name: folder,
        container: container,
        isPublic,
      });
      await this.storageProvider.container(container).createFolder(folder);
    }
  }

  private async storeNewFile(
    data: string,
    container: string,
    folder: string,
    isPublic: boolean,
    name: string,
    mimeType: string,
  ): Promise<File> {
    const buffer = Buffer.from(data, 'base64');
    const size = buffer.byteLength;

    await this.storageProvider
      .container(container)
      .store((folder ?? '') + name, buffer, isPublic);
    const publicUrl = isPublic
      ? await this.storageProvider
          .container(container)
          .getPublicUrl((folder ?? '') + name)
      : null;
    ConduitGrpcSdk.Metrics?.increment('files_total');
    ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', size);
    return await File.getInstance().create({
      name,
      mimeType,
      folder: folder,
      container: container,
      size,
      isPublic,
      url: publicUrl,
    });
  }

  private async storeUpdatedFile(
    container: string,
    folder: string,
    name: string,
    found: File,
    fileData: any,
    isDataUpdate: boolean,
  ): Promise<File> {
    await this.storageProvider
      .container(container)
      .store((folder ?? '') + name, fileData);
    // calling delete after store call succeeds
    if (!isDataUpdate) {
      await this.storageProvider
        .container(found.container)
        .delete((found.folder ?? '') + found.name);
    }

    const fileSizeDiff = Math.abs(found.size - fileData.byteLength);
    fileSizeDiff < 0
      ? ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', fileSizeDiff)
      : ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', fileSizeDiff);
    found.name = name;
    found.folder = folder;
    found.container = container;
    found.size = fileData.byteLength;
    return (await File.getInstance().findByIdAndUpdate(found._id, found)) as File;
  }
}
