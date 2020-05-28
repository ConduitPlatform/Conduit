import ConduitGrpcSdk from '@conduit/grpc-sdk';
import { ConduitSDK } from '@conduit/sdk';
import grpc from "grpc";
import { Request, Response } from 'express';
import { isNil, isEmpty } from 'lodash';
import { ConduitUtilities } from '../../../../libraries/utilities/dist';

export class AdminHandlers {
  private readonly database: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk, private readonly sdk: ConduitSDK) {
    this.database = grpcSdk.databaseProvider;
  }

  async getModules(req: Request, res: Response) {
    const registeredModules = (req as any).conduit.registeredModules;
    if (registeredModules.size !== 0) {
      let modules: any[] = [];
      registeredModules.forEach((value: string, key: string) => {
        modules.push({
          moduleName: key,
          url: value
        })
      });
      return res.json({ modules });
    } else {
      return res.status(404).json({ message: 'Modules not available' });
    }
  }

  async getConfig(req: Request, res: Response) {

    const registeredModules: Map<string, string> = (req as any).conduit.registeredModules;

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
        if (!registeredModules.has(module)) return res.json({ message: 'Module not available' });
        finalConfig = dbConfig.authentication;
        break;
      case 'email':
        if (!registeredModules.has(module)) return res.json({ message: 'Module not available' });
        finalConfig = dbConfig.email;
        break;
      case 'storage':
        if (!registeredModules.has(module)) return res.json({ message: 'Module not available' });
        finalConfig = dbConfig.storage;
        break;
      case 'push-notifications':
        if (!registeredModules.has(module)) return res.json({ message: 'Module not available' });
        finalConfig = dbConfig.pushNotifications;
        break;
      case 'in-memory-store':
        if (!registeredModules.has(module)) return res.json({ message: 'Module not available' });
        finalConfig = dbConfig.inMemoryStore;
        break;
      default:
        return res.status(404).json({ error: 'Resource not found' });
    }

    if (isEmpty(finalConfig)) return res.json({active: false});
    return res.json(finalConfig);
  }

  async setConfig(req: Request, res: Response) {
    const registeredModules: Map<string, string> = (req as any).conduit.registeredModules;

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
        if (!registeredModules.has(moduleName) || isNil(this.grpcSdk.authentication)) return res.json({ message: 'Module not available' });
        updatedConfig = await this.sdk.getAuthentication().setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      case 'email':
        if (!registeredModules.has(moduleName) || isNil(this.grpcSdk.emailProvider)) return res.json({ message: 'Module not available' });
        updatedConfig = await this.grpcSdk.emailProvider.setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      case 'in-memory-store':
        if (!registeredModules.has(moduleName) || isNil(this.grpcSdk.inMemoryStore)) return res.json({ message: 'Module not available' });
        updatedConfig = await this.grpcSdk.inMemoryStore.setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      case 'push-notifications':
        if (!registeredModules.has(moduleName) || isNil(this.grpcSdk.pushNotifications)) return res.json({ message: 'Module not available' });
        updatedConfig = await this.sdk.getPushNotifications().setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      case 'storage':
        if (!registeredModules.has(moduleName) || isNil(this.grpcSdk.storage)) return res.json({ message: 'Module not available' });
        updatedConfig = await this.sdk.getStorage().setConfig(newConfig).catch((e: Error) => errorMessage = e.message);
        break;
      default:
        return res.status(404).json({ error: 'Resource not found' });
    }

    if (!isNil(errorMessage)) return res.status(403).json({error: errorMessage});
    return res.json(updatedConfig);

  }
}
