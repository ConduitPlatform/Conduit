import { isNil } from 'lodash';
import { Application, NextFunction, Request, Response } from 'express';
import { createStorageProvider, IStorageProvider } from '@conduit/storage-provider';
import { editConfig, getConfig } from './admin/config';

class StorageModule {
  private static instance: StorageModule | null = null;
  private readonly storageProvider: IStorageProvider;

  private constructor(app: Application) {
    const config = (app as any).conduit.config;
    const storageConfig = config.get('storage');

    const { provider, storagePath, google } = storageConfig;

    this.storageProvider = createStorageProvider(provider, { storagePath, google });

    const admin = (app as any).conduit.getAdmin();

    this.registerAdminRoutes(admin);

    (app as any).conduit.storageProvider = this.storageProvider;
  }

  private registerAdminRoutes(admin: any) {
    admin.registerRoute('PUT', '/storage/config', (req: Request, res: Response, next: NextFunction) => editConfig(req, res).catch(next));
    admin.registerRoute('GET', '/storage/config', (req: Request, res: Response, next: NextFunction) => getConfig(req, res).catch(console.log));
  }

  static getInstance(app?: Application) {
    if (isNil(StorageModule.instance)) {
      if (isNil(app)) {
        throw new Error('Application not provided');
      }
      StorageModule.instance = new StorageModule(app);
    }
    return StorageModule.instance;
  }
}

export = StorageModule;
