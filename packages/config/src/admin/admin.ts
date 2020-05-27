import ConduitGrpcSdk from '@conduit/grpc-sdk';
import { ConduitSDK } from '@conduit/sdk';
import grpc from "grpc";
import { Request, Response } from 'express';
import { isNil, isEmpty } from 'lodash';

export class AdminHandlers {
  private readonly database: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk, private readonly sdk: ConduitSDK) {
    this.database = grpcSdk.databaseProvider;
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

  async moduleList(req: Request, res: Response) {
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
}
