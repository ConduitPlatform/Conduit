import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { ConduitCommons, PlatformTypesEnum } from '@quintessential-sft/conduit-commons';
import { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

export class Admin {
  constructor(
    private readonly conduit: ConduitCommons,
    private readonly grpcSdk: ConduitGrpcSdk
  ) {
    this.createClientRoutes();
  }

  createClientRoutes() {
    this.conduit
      .getAdmin()
      .registerRoute('POST', '/security/client', this.createClient.bind(this));
    this.conduit
      .getAdmin()
      .registerRoute('DELETE', '/security/client/:id', this.deleteClient.bind(this));
    this.conduit
      .getAdmin()
      .registerRoute('GET', '/security/client', this.getClients.bind(this));
  }

  async createClient(req: Request, res: Response, next: NextFunction) {
    const { platform } = req.body;
    if (!Object.values(PlatformTypesEnum).includes(platform)) {
      return res.status(400).json({
        name: 'INVALID_PARAMS',
        status: 400,
        message: 'Platform not supported',
      });
    }

    let clientId = randomBytes(15).toString('hex');
    let clientSecret = randomBytes(64).toString('hex');
    let error: string;
    let hash = await bcrypt.hash(clientSecret, 10);
    let client = await this.grpcSdk.databaseProvider
      ?.create('Client', {
        clientId,
        clientSecret: hash,
        platform,
      })
      .catch((err: Error) => (error = err.message));
    // @ts-ignore
    if (error) {
      console.error(error);
      return res.status(500).json({
        name: 'INTERNAL_SERVER_ERROR',
        status: 500,
        message: error ?? 'Something went wrong',
      });
    }

    return res.json({ id: client._id, clientId, clientSecret, platform });
  }

  async deleteClient(req: Request, res: Response, next: NextFunction) {
    if (!req.params.id)
      return res.status(400).json({
        name: 'INVALID_PARAMS',
        status: 400,
        message: 'id missing',
      });
    this.grpcSdk.databaseProvider
      ?.deleteOne('Client', { _id: req.params.id })
      .then((client: any) => {
        return res.json({ message: 'Client deleted' });
      })
      .catch((e) => {
        return res.status(500).json({
          name: 'INTERNAL_SERVER_ERROR',
          status: 500,
          message: e.message ?? 'Something went wrong',
        });
      });
  }

  async getClients(req: Request, res: Response, next: NextFunction) {
    this.grpcSdk.databaseProvider
      ?.findMany('Client', {})
      .then((clients: any) => {
        res.json(clients);
      })
      .catch((e) => {
        return res.status(500).json({
          name: 'INTERNAL_SERVER_ERROR',
          status: 500,
          message: e.message ?? 'Something went wrong',
        });
      });
  }
}
