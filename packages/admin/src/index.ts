import { isNil } from 'lodash';
import AdminSchema from './models/Admin';
import { hashPassword } from './utils/auth';
import { Application, Router, Handler } from 'express';
import { authMiddleware } from './middleware/authentication';
import { loginAdmin } from './handlers/auth';

const router = Router();

function registerRoute(method: string, route: string, handler: Handler) {
  switch (method) {
    case 'GET':
      router.get(route, handler);
      break;
    case 'POST':
      router.post(route, handler);
      break;
    case 'PUT':
      router.put(route, handler);
      break;
    case 'DELETE':
      router.delete(route, handler);
      break;
    default:
      router.get(route, handler);
  }
}

function registerSchemas(adapter: any) {
  adapter.createSchemaFromAdapter(AdminSchema);
}

export async function init(app: Application) {
  const { conduit } = app as any;

  if (isNil(conduit)) {
    throw new Error('Conduit not initialized');
  }

  const { database, config } = conduit;

  const databaseAdapter = database.getDbAdapter();

  registerSchemas(databaseAdapter);

  const AdminModel = databaseAdapter.getSchema('Admin');

  const existing = await AdminModel.findOne({ username: 'admin' });
  if (isNil(existing)) {
    const hashRounds = config.get('admin.auth.hashRounds');
    const password = await hashPassword('admin', hashRounds);
    await AdminModel.create({ username: 'admin', password });
  }

  conduit.admin = {
    registerRoute
  };

  app.post('/admin/login', (req, res, next) => loginAdmin(req, res, next).catch(next));
  app.use('/admin', authMiddleware, router);
}
