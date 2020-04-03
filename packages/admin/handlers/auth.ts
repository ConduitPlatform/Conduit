import { NextFunction, Request, Response } from 'express';
import { isNil } from 'lodash';
import { comparePasswords, signToken } from '../utils/auth';

export async function loginAdmin(req: Request, res: Response, next: NextFunction) {
  const { conduit } = req.app as any;
  const { database, config } = conduit;
  const databaseAdapter = database.getDbAdapter();
  const AdminModel = databaseAdapter.getSchema('Admin');

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
