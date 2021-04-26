import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { ConduitCommons, PlatformTypesEnum } from '@quintessential-sft/conduit-commons';
import { NextFunction, Request, Response } from 'express';
import { randomBytes } from 'crypto';

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
      return res.status(401).json({ error: 'Invalid platform' });
    }

    let clientId = Math.random().toString(36).substring(10);
    let clientSecret = randomBytes(64).toString('hex');
    let error;

    await this.grpcSdk.databaseProvider
      ?.create('Client', {
        clientId,
        clientSecret,
        platform,
      })
      .catch((err) => (error = err));
    if (error) {
      console.error(error);
      return res.status(500).json({ message: 'Something went wrong!' });
    }

    return res.json({ clientId, clientSecret, platform });
  }

  async deleteClient(req: Request, res: Response, next: NextFunction) {
    if (!req.params.id) res.status(400).json({ message: 'Client parameter missing' });
    this.grpcSdk.databaseProvider
      ?.deleteOne('Client', { _id: req.params.id })
      .then((client: any) => {
        return res.json({ message: 'Client deleted' });
      })
      .catch((e) => {
        return res.status(500).json({ message: 'Client update failed!' });
      });
  }

  async getClients(req: Request, res: Response, next: NextFunction) {
    this.grpcSdk.databaseProvider
      ?.findMany('Client', {})
      .then((clients: any) => {
        res.json(clients);
      })
      .catch((e) => {
        return res.status(500).json({ message: 'Client fetch failed!' });
      });
  }
}
