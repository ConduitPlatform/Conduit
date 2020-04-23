import { createStorageProvider, IStorageProvider } from '@conduit/storage-provider';
import { ConduitSDK, IConduitStorage } from '@conduit/sdk';
import { FileRoutes } from './routes/file';
import File from './models/File';
import StorageConfigSchema from './config/storage';
import { isNil, isPlainObject } from 'lodash';

class StorageModule extends IConduitStorage {
  private storageProvider: IStorageProvider;

  constructor(
    private readonly conduit: ConduitSDK
) {
    super(conduit);

  }

  static get config() {
    return StorageConfigSchema;
  }

  validateConfig(configInput: any, configSchema: any = StorageConfigSchema.storage): boolean {
    if (isNil(configInput)) return false;

    return Object.keys(configInput).every(key => {
      if (configSchema.hasOwnProperty(key)) {
        if (isPlainObject(configInput[key])) {
          return this.validateConfig(configInput[key], configSchema[key])
        } else if (configSchema[key].hasOwnProperty('format')) {
          const format = configSchema[key].format.toLowerCase();
          if (typeof configInput[key] === format) {
            return true;
          }
        }
      }
      return false;
    });
  }

  async initModule() {
    try {
      if ((this.conduit as any).config.get('storage.active')) {
        await this.enableModule(); // TODO in which case does this throw?
        return true;
      }
      throw new Error('Module is not active');
    } catch (e) {
      console.log(e);
      return false;
    }
  }

  private async enableModule() {
    const config = (this.conduit as any).config;
    const storageConfig = config.get('storage');

    const { provider, storagePath, google } = storageConfig;

    this.storageProvider = createStorageProvider(provider, { storagePath, google });

    this.registerModels();
    this.registerRoutes();
  }

  private registerModels() {
    const database = this.conduit.getDatabase();
    database.createSchemaFromAdapter(File);
  }

  private registerRoutes() {
    new FileRoutes(this.conduit, this.storageProvider);
  }
}

export = StorageModule;
