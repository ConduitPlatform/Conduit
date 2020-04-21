import { ConduitError, ConduitRouteParameters, ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { isString, isNil } from 'lodash';
import { IStorageProvider } from '@conduit/storage-provider';
import { v4 as uuid } from 'uuid';

export class FileHandlers {
  private readonly database: IConduitDatabase;

  constructor(
    private readonly sdk: ConduitSDK,
    private readonly storageProvider: IStorageProvider
  ) {
    this.database = sdk.getDatabase();
  }

  async createFile(params: ConduitRouteParameters) {
    const user = params.context?.user;
    if (isNil(user)) {
      throw ConduitError.forbidden('Invalid credentials');
    }

    const File = this.database.getSchema('File');

    const name = params.params?.name;
    const data = params.params?.data;
    const folder = params.params?.folder;
    const mimeType = params.params?.mimeType;

    if (!isString(data)) {
      throw ConduitError.userInput('Invalid data provided');
    }

    if (!isString(folder)) {
      throw ConduitError.userInput('No folder provided');
    }

    const buffer = Buffer.from(data, 'base64');

    const exists = await this.storageProvider.folder(folder).exists('');
    if (!exists) {
      await this.storageProvider.folder('').createFolder(folder);
    }

    await this.storageProvider.folder(folder).store(name, buffer);

    return File.create({ name, mimeType, user, folder });
  }

  async getFile(params: ConduitRouteParameters) {
    const id = params.params?.id;
    const user = params.context?.user;
    if (isNil(user)) {
      throw ConduitError.forbidden('Invalid credentials');
    }
    if (!isString(id)) {
      throw ConduitError.userInput('The provided id is invalid');
    }
    const File = this.database.getSchema('File');

    const found = await File.findOne({ _id: id, user: user._id });
    if (isNil(found)) {
      throw ConduitError.notFound('File not found');
    }
    // probably a buffer
    const file = await this.storageProvider.folder(found.folder).get(found.name).catch(error => {
      throw ConduitError.notFound('File not found');
    });

    let data;
    if (Buffer.isBuffer(file)) {
      data = file.toString('base64');
    } else {
      data = Buffer.from(file.toString()).toString('base64');
    }

    return {
      ...found,
      data
    };
  }

  async deleteFile(params: ConduitRouteParameters) {
    const id = params.params?.id;
    const user = params.context?.user;
    if (isNil(user)) {
      throw ConduitError.forbidden('Invalid credentials');
    }
    if (!isString(id)) {
      throw ConduitError.userInput('The provided id is invalid');
    }
    const File = this.database.getSchema('File');
    const found = await File.findOne({ _id: id, user: user._id });
    if (isNil(found)) {
      throw ConduitError.notFound('File not found');
    }

    const success = await this.storageProvider.folder(found.folder).delete(found.name);
    if (!success) {
      throw ConduitError.internalServerError('Error deleting the file');
    }

    await File.deleteOne({ _id: id });

    return { success: true };
  }

  async updateFile(params: ConduitRouteParameters) {
    const id = params.params?.id;
    const user = params.context?.user;
    if (isNil(user)) {
      throw ConduitError.forbidden('Invalid credentials');
    }
    if (!isString(id)) {
      throw ConduitError.userInput('The provided id is invalid');
    }
    const File = this.database.getSchema('File');
    const found = await File.findOne({ _id: id, user: user._id });
    if (isNil(found)) {
      throw ConduitError.notFound('File not found');
    }

    // Create temporary file to make the changes so the original is not corrupted if anything fails
    const tempFileName = uuid();
    const oldData = await this.storageProvider.folder(found.folder).get(found.name)
      .catch(error => {
        throw ConduitError.internalServerError('Error reading file');
      });

    const exists = await this.storageProvider.folder('temp').exists('');
    if (!exists) {
      await this.storageProvider.folder('temp').createFolder('');
    }

    await this.storageProvider.folder('temp').store(tempFileName, oldData)
      .catch(error => {
        console.log(error);
        throw ConduitError.internalServerError('I/O error');
      });

    let failed = false;

    const data = params.params?.data;
    if (!isNil(data)) {
      const buffer = Buffer.from(data, 'base64');
      await this.storageProvider.folder('temp').store(tempFileName, buffer)
        .catch(error => {
          failed = true;
        });
    }

    const newName = params.params?.name ?? found.name;
    const newFolder = params.params?.folder ?? found.folder;

    const shouldRemove = newName !== found.name;

    found.mimeType = params.params?.mimeType ?? found.mimeType;

    // Commit the changes to the actual file if everything is successful
    if (failed) {
      await this.storageProvider.folder('temp').delete(tempFileName);
      throw ConduitError.internalServerError();
    }
    await this.storageProvider.folder('temp').moveToFolderAndRename(tempFileName, newName, newFolder)
      .catch(error => {
        throw ConduitError.internalServerError('I/O error');
      });

    if (shouldRemove) {
      await this.storageProvider.folder(found.folder).delete(found.name);
    }

    found.name = newName;
    found.folder = newFolder;

    return File.findByIdAndUpdate(found);
  }
}
