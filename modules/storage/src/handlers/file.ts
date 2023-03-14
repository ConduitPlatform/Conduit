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
      : await this.findOrCreateContainer(container, isPublic);
    if (!isNil(folder)) {
      await this.findOrCreateFolder(newFolder, usedContainer, isPublic);
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

  async createFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, folder, container, size = 0, mimeType, isPublic } = call.request.params;
    let newFolder;
    if (isNil(folder)) {
      newFolder = '/';
    } else {
      newFolder = folder.trim().slice(-1) !== '/' ? folder.trim() + '/' : folder.trim();
    }
    const config = ConfigController.getInstance().config;
    const usedContainer = isNil(container)
      ? config.defaultContainer
      : await this.findOrCreateContainer(container, isPublic);
    if (!isNil(folder)) {
      await this.findOrCreateFolder(newFolder, usedContainer, isPublic);
    }

    const exists = await File.getInstance().findOne({
      name,
      container: usedContainer,
      folder: newFolder,
    });
    if (exists) {
      throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
    }

    try {
      return await this._createFileUploadUrl(
        usedContainer,
        newFolder,
        isPublic,
        name,
        size,
        mimeType,
      );
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }

  async updateFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, mimeType, size } = call.request.params;
    const found = await File.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    const { name, folder, container } = await this.validateFilenameAndContainer(
      call,
      found,
    );
    try {
      return await this._updateFile(
        name,
        folder,
        container,
        null,
        mimeType ?? found.mimeType,
        found,
        size,
      );
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }

  async updateFile(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { id, data, mimeType } = call.request.params;
    const found = await File.getInstance().findOne({ _id: id });
    if (isNil(found)) {
      throw new GrpcError(status.NOT_FOUND, 'File does not exist');
    }
    const { name, folder, container } = await this.validateFilenameAndContainer(
      call,
      found,
    );
    try {
      return await this._updateFile(
        name,
        folder,
        container,
        data,
        mimeType ?? found.mimeType,
        found,
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
      const result = await this.storageProvider
        .container(file.container)
        .get(file.folder ? file.folder + file.name : file.name);
      if (result instanceof Error) {
        throw result;
      } else {
        data = result;
      }
      return { data: data.toString('base64') };
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong!',
      );
    }
  }

  private async findOrCreateContainer(
    container: string,
    isPublic?: boolean,
  ): Promise<string> {
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

  private async findOrCreateFolder(
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

  private async _createFileUploadUrl(
    container: string,
    folder: string,
    isPublic: boolean,
    name: string,
    size: number,
    mimeType: string,
  ): Promise<string> {
    await this.storageProvider
      .container(container)
      .store((folder ?? '') + name, Buffer.from('PENDING UPLOAD'), isPublic);
    const publicUrl = isPublic
      ? await this.storageProvider
          .container(container)
          .getPublicUrl((folder ?? '') + name)
      : null;
    ConduitGrpcSdk.Metrics?.increment('files_total');
    ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', size);
    await File.getInstance().create({
      name,
      mimeType,
      folder: folder,
      container: container,
      isPublic,
      url: publicUrl,
    });
    return (await this.storageProvider
      .container(container)
      .getUploadUrl((folder ?? '') + name)) as string;
  }

  private async validateFilenameAndContainer(call: ParsedRouterRequest, file: File) {
    const { name, folder, container } = call.request.params;
    const newName = name ?? file.name;
    const newContainer = container ?? file.container;
    if (newContainer !== file.container) {
      await this.findOrCreateContainer(newContainer);
    }
    // Existing folder names are currently suffixed by "/" upon creation
    const newFolder = isNil(folder)
      ? file.folder
      : folder.trim().slice(-1) !== '/'
      ? folder.trim() + '/'
      : folder.trim();
    if (newFolder !== file.folder) {
      await this.findOrCreateFolder(newFolder, newContainer);
    }
    const exists = await File.getInstance().findOne({
      name: newName,
      container: newContainer,
      folder: newFolder,
    });
    if (!isNil(exists)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
    }
    return {
      name: newName,
      folder: newFolder,
      container: newContainer,
    };
  }

  private async _updateFile(
    name: string,
    folder: string,
    container: string,
    data: any,
    mimeType: string,
    file: File,
    size?: number,
  ): Promise<File | string> {
    const newData = isNil(data)
      ? Buffer.from('PENDING UPLOAD')
      : Buffer.from(data, 'base64');
    const url = file.isPublic
      ? await this.storageProvider.container(container).getPublicUrl(folder + name)
      : null;
    await this.storageProvider
      .container(container)
      .store(folder + name, newData, file.isPublic);
    await this.storageProvider.container(file.container).delete(file.folder + file.name);
    const updatedFile = (await File.getInstance().findByIdAndUpdate(file._id, {
      name,
      folder,
      container,
      url,
      mimeType,
    })) as File;
    if (isNil(data)) {
      if (!isNil(size)) this.updateFileMetrics(file.size, size!);
      return (await this.storageProvider
        .container(container)
        .getUploadUrl(folder + name)) as string;
    } else {
      this.updateFileMetrics(file.size, newData.byteLength);
      return updatedFile;
    }
  }

  private updateFileMetrics(currentSize: number, newSize: number) {
    const fileSizeDiff = Math.abs(currentSize - newSize);
    fileSizeDiff < 0
      ? ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', fileSizeDiff)
      : ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', fileSizeDiff);
  }
}
