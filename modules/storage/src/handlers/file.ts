import { isNil, isString } from 'lodash';
import { IStorageProvider } from '@quintessential-sft/storage-provider';
import ConduitGrpcSdk, {
  RouterRequest,
  RouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '../admin/Config.controller';

export class FileHandlers {
  private database: any;
  private storageProvider: IStorageProvider;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    storageProvider: IStorageProvider
  ) {
    this.storageProvider = storageProvider;
    this.initDb(grpcSdk, storageProvider);
  }

  get storage() {
    return this.storageProvider;
  }

  async initDb(grpcSdk: ConduitGrpcSdk, storageProvider: IStorageProvider) {
    await grpcSdk.waitForExistence('database-provider');
    this.database = grpcSdk.databaseProvider;
  }

  updateProvider(storageProvider: IStorageProvider) {
    this.storageProvider = storageProvider;
  }

  async createFile(call: RouterRequest, callback: RouterResponse) {
    const { name, data, folder, container, mimeType, isPublic } = JSON.parse(
      call.request.params
    );
    let config = ConfigController.getInstance().config;

    let usedContainer = container;
    // the container is sent from the client
    if (isNil(usedContainer)) {
      usedContainer = config.defaultContainer;
    } else {
      let container = await this.database.findOne('_StorageContainer', {
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
        await this.database.create('_StorageContainer', { usedContainer, isPublic });
      }
    }

    if (!isString(data)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'Invalid data provided',
      });
    }

    try {
      const buffer = Buffer.from(data, 'base64');
      let exists;
      if (!isNil(folder)) {
        exists = await this.storageProvider.folderExists(folder);
        if (!exists) {
          await this.database.create('_StorageFolder', {
            name: folder,
            container: usedContainer,
            isPublic,
          });
          await this.storageProvider.container(usedContainer).createFolder(folder);
        }

        await this.storageProvider.container(usedContainer).store(folder + name, buffer);
      } else {
        await this.storageProvider.container(usedContainer).store(name, buffer);
      }

      let publicUrl = null;
      if (isPublic) {
        publicUrl = await this.storageProvider.container(folder).getPublicUrl(name);
      }

      const newFile = await this.database.create('File', {
        name,
        mimeType,
        folder,
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
      const file = await this.database.findOne('File', { _id: id });
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
      const file = await this.database.findOne('File', { _id: id });
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
    const { id } = JSON.parse(call.request.params);
    if (!isString(id)) {
      return callback({
        code: status.INVALID_ARGUMENT,
        message: 'The provided id is invalid',
      });
    }

    try {
      const found = await this.database.findOne('File', { _id: id });
      if (isNil(found)) {
        return callback({ code: status.NOT_FOUND, message: 'File not found' });
      }
      if (found.isPublic) {
        return callback(null, { redirect: found.url });
      }
      if (found.folder) {
        return callback(null, {
          redirect: await this.storageProvider
            .container(found.container)
            .getSignedUrl(found.folder + found.name),
        });
      } else {
        return callback(null, {
          redirect: await this.storageProvider
            .container(found.container)
            .getSignedUrl(found.name),
        });
      }
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
      let found = await this.database.findOne('File', { _id: id });

      if (isNil(found)) {
        return callback({ code: status.NOT_FOUND, message: 'File not found' });
      }
      let success = await this.storageProvider.container(found.folder).delete(found.name);
      if (!success) {
        return callback({
          code: status.INTERNAL,
          message: 'File could not be deleted',
        });
      }
      await this.database.deleteOne('File', { _id: id });

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
      const found = await this.database.findOne('File', { _id: id });
      if (isNil(found)) {
        return callback({ code: status.NOT_FOUND, message: 'File not found' });
      }
      let config = ConfigController.getInstance().config;
      let fileData = await this.storageProvider
        .container(found.container)
        .get(found.name);

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
        let container = await this.database.findOne('_StorageContainer', {
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
          await this.database.create('_StorageContainer', { newContainer });
        }
      }

      if (newFolder !== found.folder) {
        let exists = await this.storageProvider
          .container(newContainer)
          .folderExists(newFolder);
        if (!exists) {
          await this.database.create('_StorageFolder', {
            name: newFolder,
            container: newContainer,
          });
          await this.storageProvider.container(newContainer).createFolder(newFolder);
        }
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

      const updatedFile = await this.database.findByIdAndUpdate('File', found);

      return callback(null, {
        result: JSON.stringify({
          id: updatedFile._id,
          name: updatedFile.name,
          url: updatedFile.url,
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
