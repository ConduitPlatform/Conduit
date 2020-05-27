import ConduitGrpcSdk from '@conduit/grpc-sdk';
import { ConduitSDK } from '@conduit/sdk';
import grpc from "grpc";
import { Request, Response } from 'express';

export class AdminHandlers {
  private readonly database: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk, private readonly sdk: ConduitSDK) {
    this.database = grpcSdk.databaseProvider;
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
