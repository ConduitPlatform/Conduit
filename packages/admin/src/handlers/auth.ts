import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { comparePasswords, hashPassword, signToken } from '../utils/auth';
import { ConduitCommons, IConfigManager } from '@quintessential-sft/conduit-commons';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

export class AuthHandlers {
  private readonly conduit: ConduitCommons;
  private readonly grpcSdk: ConduitGrpcSdk;

  constructor(grpcSdk: ConduitGrpcSdk, conduit: ConduitCommons) {
    this.conduit = conduit;
    this.grpcSdk = grpcSdk;
  }

  async loginAdmin(req: Request, res: Response, next: NextFunction) {
    const config: IConfigManager = this.conduit.getConfigManager();
    const database = this.grpcSdk.databaseProvider!;

    const { username, password } = req.body;
    if (isNil(username) || isNil(password)) {
      return res
        .status(400)
        .json({ error: 'Both username and password must be provided' });
    }

    const admin = await database.findOne('Admin', { username });
    if (isNil(admin)) {
      return res.status(403).json({ error: 'Invalid username/password' });
    }
    const passwordsMatch = await comparePasswords(password, admin.password);
    if (!passwordsMatch) {
      return res.status(403).json({ error: 'Invalid username/password' });
    }

    let authConfig = await config.get('admin');
    authConfig = authConfig.auth;
    const { tokenSecret, tokenExpirationTime } = authConfig;

    const token = signToken(
      { id: admin._id.toString() },
      tokenSecret,
      tokenExpirationTime
    );

    return res.json({ token });
  }

  async createAdmin(req: Request, res: Response, next: NextFunction) {
    const config: IConfigManager = this.conduit.getConfigManager();
    const database = this.grpcSdk.databaseProvider!;

    const { username, password } = req.body;
    if (isNil(username) || isNil(password)) {
      return res
        .status(400)
        .json({ error: 'Both username and password must be provided' });
    }

    const admin = await database.findOne('Admin', { username });
    if (!isNil(admin)) {
      return res.status(403).json({ error: 'Already exists' });
    }
    const adminConfig = await this.conduit.getConfigManager().get('admin');
    const hashRounds = adminConfig.auth.hashRounds;
    let pass = hashPassword(password, hashRounds);
    await database.create('Admin', { username: username, password: pass });
    return res.json({ message: 'OK' });
  }
}
