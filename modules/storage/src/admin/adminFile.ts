import ConduitGrpcSdk, {
  DatabaseProvider,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { isNil, isString } from 'lodash-es';
import { _StorageContainer, _StorageFolder, File } from '../models/index.js';
import { IStorageProvider } from '../interfaces/index.js';
import { deepPathHandler, normalizeFolderPath } from '../utils/index.js';

export class AdminFileHandlers {
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
    const { name, data, container, mimeType, isPublic } = call.request.params;
    const folder = normalizeFolderPath(call.request.params.folder);
    const config = ConfigController.getInstance().config;
    const usedContainer = isNil(container)
      ? config.defaultContainer
      : await this.findOrCreateContainer(container, isPublic);
    if (folder !== '/') {
      await this.findOrCreateFolders(folder, usedContainer, isPublic);
    }

    const exists = await File.getInstance().findOne({
      name,
      container: usedContainer,
      folder,
    });
    if (exists) {
      throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
    }
    if (!isString(data)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid data provided');
    }

    try {
      const file = await this.storeNewFile(
        data,
        usedContainer,
        folder,
        isPublic,
        name,
        mimeType,
      );
      return file;
    } catch (e) {
      throw new GrpcError(
        status.INTERNAL,
        (e as Error).message ?? 'Something went wrong',
      );
    }
  }

  async createFileUploadUrl(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { name, container, size = 0, mimeType, isPublic } = call.request.params;
    const folder = normalizeFolderPath(call.request.params.folder);
    const config = ConfigController.getInstance().config;
    const usedContainer = isNil(container)
      ? config.defaultContainer
      : await this.findOrCreateContainer(container, isPublic);
    if (folder !== '/') {
      await this.findOrCreateFolders(folder, usedContainer, isPublic);
    }

    const exists = await File.getInstance().findOne({
      name,
      container: usedContainer,
      folder,
    });
    if (exists) {
      throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
    }

    try {
      const { file, url } = await this._createFileUploadUrl(
        usedContainer,
        folder,
        isPublic,
        name,
        size,
        mimeType,
      );
      return { file, url };
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
      return await this._updateFileUploadUrl(
        name,
        folder,
        container,
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
        Buffer.from(data, 'base64'),
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
        .delete((found.folder === '/' ? '' : found.folder) + found.name);
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
        .getSignedUrl((found.folder === '/' ? '' : found.folder) + found.name);

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
        .get(
          file.folder ? (file.folder === '/' ? '' : file.folder) + file.name : file.name,
        );
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

  async findOrCreateFolders(
    folderPath: string,
    container: string,
    isPublic?: boolean,
    lastExistsHandler?: () => void,
  ): Promise<_StorageFolder[]> {
    const createdFolders: _StorageFolder[] = [];
    let folder: _StorageFolder | null = null;
    await deepPathHandler(folderPath, async (folderPath, isLast) => {
      folder = await _StorageFolder
        .getInstance()
        .findOne({ name: folderPath, container });
      if (isNil(folder)) {
        folder = await _StorageFolder.getInstance().create({
          name: folderPath,
          container,
          isPublic,
        });
        createdFolders.push(folder);
        const exists = await this.storage.container(container).folderExists(folderPath);
        if (!exists) {
          await this.storage.container(container).createFolder(folderPath);
        }
      } else if (isLast) {
        lastExistsHandler?.();
      }
    });
    return createdFolders;
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
      .store((folder === '/' ? '' : folder) + name, buffer, isPublic);
    const publicUrl = isPublic
      ? await this.storageProvider
          .container(container)
          .getPublicUrl((folder === '/' ? '' : folder) + name)
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
  ): Promise<{ file: File; url: string }> {
    await this.storageProvider
      .container(container)
      .store(
        (folder === '/' ? '' : folder) + name,
        Buffer.from('PENDING UPLOAD'),
        isPublic,
      );
    const publicUrl = isPublic
      ? await this.storageProvider
          .container(container)
          .getPublicUrl((folder === '/' ? '' : folder) + name)
      : null;
    ConduitGrpcSdk.Metrics?.increment('files_total');
    ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', size);
    const file = await File.getInstance().create({
      name,
      mimeType,
      size,
      folder: folder,
      container: container,
      isPublic,
      url: publicUrl,
    });
    const url = (await this.storageProvider
      .container(container)
      .getUploadUrl((folder === '/' ? '' : folder) + name)) as string;
    return {
      file,
      url,
    };
  }

  private async validateFilenameAndContainer(call: ParsedRouterRequest, file: File) {
    const { name, folder, container } = call.request.params;
    const newName = name ?? file.name;
    const newContainer = container ?? file.container;
    if (newContainer !== file.container) {
      await this.findOrCreateContainer(newContainer);
    }
    const newFolder = isNil(folder) ? file.folder : normalizeFolderPath(folder);
    if (newFolder !== file.folder && newFolder !== '/') {
      await this.findOrCreateFolders(newFolder, newContainer);
    }
    const isDataUpdate =
      newName === file.name &&
      newFolder === file.folder &&
      newContainer === file.container;
    const exists = await File.getInstance().findOne({
      name: newName,
      container: newContainer,
      folder: newFolder,
    });
    if (!isDataUpdate && !isNil(exists)) {
      throw new GrpcError(status.ALREADY_EXISTS, 'File already exists');
    }
    return {
      name: newName,
      folder: newFolder,
      container: newContainer,
    };
  }

  private async _updateFileUploadUrl(
    name: string,
    folder: string,
    container: string,
    mimeType: string,
    file: File,
    size: number | undefined | null,
  ): Promise<{ file: File; url: string }> {
    let updatedFile;
    const onlyDataUpdate =
      name === file.name && folder === file.folder && container === file.container;
    if (onlyDataUpdate) {
      updatedFile = await File.getInstance().findByIdAndUpdate(file._id, {
        mimeType,
        ...{ size: size ?? file.size },
      });
    } else {
      await this.storageProvider
        .container(container)
        .store(
          (folder === '/' ? '' : folder) + name,
          Buffer.from('PENDING UPLOAD'),
          file.isPublic,
        );
      await this.storageProvider
        .container(file.container)
        .delete((file.folder === '/' ? '' : file.folder) + file.name);
      const url = file.isPublic
        ? await this.storageProvider
            .container(container)
            .getPublicUrl((folder === '/' ? '' : folder) + name)
        : null;
      updatedFile = await File.getInstance().findByIdAndUpdate(file._id, {
        name,
        folder,
        container,
        url,
        mimeType,
        ...{ size: size ?? file.size },
      });
    }
    if (!isNil(size)) this.updateFileMetrics(file.size, size!);
    const uploadUrl = (await this.storageProvider
      .container(container)
      .getUploadUrl((folder === '/' ? '' : folder) + name)) as string;
    return { file: updatedFile!, url: uploadUrl };
  }

  private async _updateFile(
    name: string,
    folder: string,
    container: string,
    data: Buffer,
    mimeType: string,
    file: File,
  ): Promise<File> {
    const onlyDataUpdate =
      name === file.name && folder === file.folder && container === file.container;
    await this.storageProvider
      .container(container)
      .store((folder === '/' ? '' : folder) + name, data, file.isPublic);
    if (!onlyDataUpdate) {
      await this.storageProvider
        .container(file.container)
        .delete((file.folder === '/' ? '' : file.folder) + file.name);
    }
    const url = file.isPublic
      ? await this.storageProvider
          .container(container)
          .getPublicUrl((folder === '/' ? '' : folder) + name)
      : null;
    const updatedFile = (await File.getInstance().findByIdAndUpdate(file._id, {
      name,
      folder,
      container,
      url,
      mimeType,
    })) as File;
    this.updateFileMetrics(file.size, data.byteLength);
    return updatedFile;
  }

  private updateFileMetrics(currentSize: number, newSize: number) {
    const fileSizeDiff = Math.abs(currentSize - newSize);
    fileSizeDiff < 0
      ? ConduitGrpcSdk.Metrics?.increment('storage_size_bytes_total', fileSizeDiff)
      : ConduitGrpcSdk.Metrics?.decrement('storage_size_bytes_total', fileSizeDiff);
  }
}
