import { ConduitError, ConduitRouteParameters, ConduitSDK, IConduitDatabase } from '@conduit/sdk';
import { isString, isNil } from 'lodash';
import { IStorageProvider } from '@conduit/storage-provider';

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

    const buffer = Buffer.from(data, 'base64');

    const file = await File.create({ name, mimeType, user, folder });
    await this.storageProvider.folder(folder).store(name, buffer);
    return file;
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
}
