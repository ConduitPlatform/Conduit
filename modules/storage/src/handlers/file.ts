import { isNil, isString } from 'lodash';
import ConduitGrpcSdk, {
  RouterRequest,
  RouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '../config/Config.controller';
import { _StorageContainer, _StorageFolder, File } from '../models';
import { IStorageProvider } from '../storage-provider';

export class FileHandlers {
  private storageProvider: IStorageProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    storageProvider: IStorageProvider
  ) {
    this.storageProvider = storageProvider;
  }

  get storage() {
    return this.storageProvider;
  }

  updateProvider(storageProvider: IStorageProvider) {
    this.storageProvider = storageProvider;
  }

  async createFile(call: RouterRequest, callback: RouterResponse) {
    const { name, data, folder, container, mimeType, isPublic } = JSON.parse(
      call.request.params
    );
    let newFolder = folder.trim().slice(-1) !== '/' ? folder.trim() + '/' : folder.trim();
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
          return callback({
            code: status.PERMISSION_DENIED,
            message: 'Container creation is not allowed!',
          });
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
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'File already exists',
      });
    }

    if (!isString(data)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid data provided',
      });
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

      return callback(null, {
        result: JSON.stringify({
          id: newFile._id,
          name: newFile.name,
          url: newFile.url,
        }),
      });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong',
      });
    }
  }

  async getFile(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);
    if (!isString(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'The provided id is invalid',
      });
    }

    try {
      const file = await File.getInstance().findOne({ _id: id });
      if (isNil(file))
        return callback({
          code: status.NOT_FOUND,
          message: 'File not found',
        });
      return callback(null, {
        result: JSON.stringify({
          id: file._id,
          name: file.name,
          url: file.url,
        }),
      });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong!',
      });
    }
  }

  async getFileData(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);
    if (!isString(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'The provided id is invalid',
      });
    }

    try {
      const file = await File.getInstance().findOne({ _id: id });
      if (isNil(file))
        return callback({
          code: status.NOT_FOUND,
          message: 'File not found',
        });

      let data: Buffer;
      if (file.folder) {
        data = await this.storageProvider
          .container(file.container)
          .get(file.folder + file.name);
      } else {
        data = await this.storageProvider.container(file.container).get(file.name);
      }
      data.toString('base64');

      return callback(null, {
        result: JSON.stringify({
          data: data.toString('base64'),
        }),
      });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong!',
      });
    }
  }

  async getFileUrl(call: RouterRequest, callback: RouterResponse) {
    const { id, redirect } = JSON.parse(call.request.params);
    if (!isString(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'The provided id is invalid',
      });
    }

    try {
      const found = await File.getInstance().findOne({ _id: id });
      if (isNil(found)) {
        return callback({ code: status.NOT_FOUND, message: 'File not found' });
      }
      if (found.isPublic) {
        return callback(null, { redirect: found.url });
      }
      let url = await this.storageProvider
        .container(found.container)
        .getSignedUrl((found.folder ?? '') + found.name);

      if (!isNil(redirect) && (redirect === 'false' || !redirect)) {
        return callback(null, {
          result: url,
        });
      }
      return callback(null, {
        redirect: url,
      });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong!',
      });
    }
  }

  async deleteFile(call: RouterRequest, callback: RouterResponse) {
    const { id } = JSON.parse(call.request.params);
    if (!isString(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'The provided id is invalid',
      });
    }

    try {
      let found = await File.getInstance().findOne({ _id: id });

      if (isNil(found)) {
        return callback({ code: status.NOT_FOUND, message: 'File not found' });
      }
      let success = await this.storageProvider
        .container(found.container)
        .delete((found.folder ?? '') + found.name);
      if (!success) {
        return callback({
          code: status.INTERNAL,
          message: 'File could not be deleted',
        });
      }
      await File.getInstance().deleteOne({ _id: id });

      return callback(null, { result: JSON.stringify({ success: true }) });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong!',
      });
    }
  }

  async updateFile(call: RouterRequest, callback: RouterResponse) {
    const { id, data, name, container, folder, mimeType } = JSON.parse(
      call.request.params
    );
    if (!isString(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'The provided id is invalid',
      });
    }

    try {
      const found = await File.getInstance().findOne({ _id: id });
      if (isNil(found)) {
        return callback({ code: status.NOT_FOUND, message: 'File not found' });
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
            return callback({
              code: status.PERMISSION_DENIED,
              message: 'Container creation is not allowed!',
            });
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
        return callback({
          code: status.INVALID_ARGUMENT,
          message: 'File already exists',
        });
      }

      await this.storageProvider
        .container(newContainer)
        .store((newFolder ?? '') + name, fileData);

      if (shouldRemove) {
        await this.storageProvider
          .container(found.container)
          .delete((found.folder ?? '') + found.name);
      }

      found.name = newName;
      found.folder = newFolder;
      found.container = newContainer;

      const updatedFile = await File.getInstance().findByIdAndUpdate(found._id, found);

      return callback(null, {
        result: JSON.stringify({
          id: updatedFile!._id,
          name: updatedFile!.name,
          url: updatedFile!.url,
        }),
      });
    } catch (e) {
      return callback({
        code: status.INTERNAL,
        message: e.message ?? 'Something went wrong!',
      });
    }
  }
}
