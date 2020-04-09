import { NextFunction, Request, Response } from 'express';
import { createStorageProvider, IStorageProvider } from '@conduit/storage-provider';
import { AdminConfigHandlers } from './admin/config';
import { ConduitSDK, IConduitAdmin, IConduitStorage } from '@conduit/sdk';

class StorageModule extends IConduitStorage{
  private readonly storageProvider: IStorageProvider;

  constructor(conduit: ConduitSDK) {
    super(conduit);

    const config = (conduit as any).config;
    const storageConfig = config.get('storage');

    const { provider, storagePath, google } = storageConfig;

    this.storageProvider = createStorageProvider(provider, { storagePath, google });

    const admin = conduit.getAdmin();
    const adminHandlers = new AdminConfigHandlers(conduit);

    this.registerAdminRoutes(admin, adminHandlers);
  }

  private registerAdminRoutes(admin: IConduitAdmin, adminHandlers: AdminConfigHandlers) {
    admin.registerRoute('PUT', '/storage/config', (req: Request, res: Response, next: NextFunction) => adminHandlers.editConfig(req, res).catch(next));
    admin.registerRoute('GET', '/storage/config', (req: Request, res: Response, next: NextFunction) => adminHandlers.getConfig(req, res).catch(next));
  }
}

export = StorageModule;
