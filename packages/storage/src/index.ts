import { createStorageProvider, IStorageProvider } from '@conduit/storage-provider';
import { ConduitSDK, IConduitStorage } from '@conduit/sdk';
import { FileRoutes } from './routes/file';
import File from './models/File';
import StorageConfigSchema from './config/storage';

class StorageModule extends IConduitStorage {
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

  async initModule() {
    try {
      if ((this.conduit as any).config.get('storage.active')) {
        if (this.isRunning) return {result: true};
        await this.enableModule();
        return {result: true};
      }
      throw new Error('Module is not active');
    } catch (e) {
      console.log(e);
      return {result: false, error: e};
    }
  }

  private async enableModule() {
    const config = (this.conduit as any).config;
    const storageConfig = config.get('storage');

    const { provider, storagePath, google } = storageConfig;

    this.storageProvider = createStorageProvider(provider, { storagePath, google });

    this.registerModels();
    this.registerRoutes();

    this.isRunning = true;

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
