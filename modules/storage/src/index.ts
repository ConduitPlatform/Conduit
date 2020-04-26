import { createStorageProvider, IStorageProvider } from '@conduit/storage-provider';
import { ConduitSDK, IConduitModule, IConduitStorage } from '@conduit/sdk';
import { FileRoutes } from './routes/file';
import File from './models/File';
import StorageConfigSchema from './config/storage';
import { isNil } from 'lodash';

class StorageModule extends IConduitStorage implements IConduitModule{
  private storageProvider: IStorageProvider;
  private isRunning: boolean = false;

  constructor(
    private readonly conduit: ConduitSDK
) {
    super(conduit);
    if ((this.conduit as any).config.get('storage.active')) {
      this.enableModule().catch(console.log);
    }
  }

  static get config() {
    return StorageConfigSchema;
  }

  async setConfig(newConfig: any) {
    if (!ConduitSDK.validateConfig(newConfig, StorageConfigSchema.storage)) {
      throw new Error('Invalid configuration values');
    }

    let errorMessage: string | null = null;
    const updateResult = await this.conduit.updateConfig(newConfig, 'storage').catch((e: Error) => errorMessage = e.message);
    if (!isNil(errorMessage)) {
      throw new Error(errorMessage);
    }

    if ((this.conduit as any).config.get('storage.active')) {
      await this.enableModule().catch((e: Error) => errorMessage = e.message);
    } else {
      throw new Error('Module is not active');
    }
    if (!isNil(errorMessage)) {
      throw new Error(errorMessage);
    }

    return updateResult;
  }

  private async enableModule() {
    const config = (this.conduit as any).config;
    if (!this.isRunning) {
      const storageConfig = config.get('storage');
      const { provider, storagePath, google } = storageConfig;
      this.storageProvider = createStorageProvider(provider, { storagePath, google });
      this.registerModels();
      this.registerRoutes();
      this.isRunning = true;
    } else {
      const storageConfig = config.get('storage');
      const { provider, storagePath, google } = storageConfig;
      this.storageProvider = createStorageProvider(provider, { storagePath, google });
    }
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
