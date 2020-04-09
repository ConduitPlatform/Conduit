import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { comparePasswords, signToken } from '../utils/auth';
import { ConduitSDK } from '@conduit/sdk';

export class AuthHandlers {

  private readonly conduit: ConduitSDK;

  constructor(conduit: ConduitSDK) {
    this.conduit = conduit;
  }

  async loginAdmin(req: Request, res: Response, next: NextFunction) {
    const { config } = this.conduit as any;
    const database = this.conduit.getDatabase();

    const AdminModel = database.getSchema('Admin');

    const { username, password } = req.body;
    if (isNil(username) || isNil(password)) {
      return res.status(400).json({ error: 'Both username and password must be provided' });
    }

    const admin = await AdminModel.findOne({ username });
    if (isNil(admin)) {
      return res.status(403).json({ error: 'Invalid username/password' });
    }
    const passwordsMatch = await comparePasswords(password, admin.password);
    if (!passwordsMatch) {
      return res.status(403).json({ error: 'Invalid username/password' });
    }

    const authConfig = config.get('admin.auth');
    const { tokenSecret, tokenExpirationTime } = authConfig;

    const token = signToken({ id: admin._id.toString() }, tokenSecret, tokenExpirationTime);

    return res.json({ token });
  }

}
