import { ConduitSDK } from '@conduit/sdk';
import { Request, Response } from 'express';
import { isNil, isEmpty } from 'lodash';
import ConduitGrpcSdk from '@conduit/grpc-sdk';
import { ConduitUtilities } from '@conduit/utilities';

export class ConfigAdminHandlers {
  private readonly database: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk, private readonly sdk: ConduitSDK) {
    this.database = grpcSdk.databaseProvider;
  }

  async getConfig(req: Request, res: Response) {

    const dbConfig = await this.database.findOne('Config', {});
    if (isNil(dbConfig)) {
      return res.json({});
    }

    let finalConfig: any;
    const module = req.params.module;

    switch (module) {
      case undefined:
        finalConfig = dbConfig;
        delete finalConfig._id;
        delete finalConfig.createdAt;
        delete finalConfig.updatedAt;
        delete finalConfig.__v;
        break;
      case 'authentication':
        finalConfig = dbConfig.authentication;
        break;
      case 'email':
        finalConfig = dbConfig.email;
        break;
      case 'storage':
        finalConfig = dbConfig.storage;
        break;
      case 'push-notifications':
        finalConfig = dbConfig.pushNotifications;
        break;
      case 'in-memory-store':
        finalConfig = dbConfig.inMemoryStore;
        break;
      default:
        return res.status(404).json({ error: 'Resource not found' });
    }

    if (isEmpty(finalConfig)) return res.json({active: false});
    return res.json(finalConfig);
  }

  async setConfig(req: Request, res: Response) {
    const dbConfig = await this.database.findOne('Config', {});
    if (isNil(dbConfig)) {
      return res.status(404).json({ error: 'Config not set' });
    }

    const newConfig = req.body;
    const moduleName = req.params.module;
    let errorMessage: string | null = null;
    let updatedConfig: any;

    if (newConfig.active === false) return res.status(403).json({error: 'Modules cannot be deactivated'});

    switch (moduleName) {
      case undefined:
        // TODO changing module settings through this endpoint completely bypasses the running check and is not secure
        if (!ConduitUtilities.validateConfigFields(newConfig, this.sdk.getConfigManager().appConfig.configSchema)) {
          errorMessage = 'Invalid configuration fields';
          break;
        }
        updatedConfig = await this.sdk.updateConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      case 'authentication':
        updatedConfig = await this.sdk.getAuthentication().setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      case 'email':
        updatedConfig = await this.sdk.getEmail().setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      case 'in-memory-store':
        updatedConfig = await this.sdk.getInMemoryStore().setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      case 'push-notifications':
        updatedConfig = await this.sdk.getPushNotifications().setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      case 'storage':
        updatedConfig = await this.sdk.getStorage().setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      default:
        return res.status(404).json({ error: 'Resource not found' });
    }

    if (!isNil(errorMessage)) return res.status(403).json({error: errorMessage});
    return res.json(updatedConfig);

  }


}
