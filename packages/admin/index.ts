import { isNil } from 'lodash';
import { hashPassword, verifyToken } from './utils/auth';
import { Application, Router, Handler, Request, Response, NextFunction } from 'express';
import { loginAdmin } from './handlers/auth';
import AdminSchema from './models/Admin';

class AdminModule {
  private readonly router: Router;
  private static instance: AdminModule | null = null;

  private constructor(app: Application) {
    this.router = Router();
    const { conduit } = app as any;

    if (isNil(conduit)) {
      throw new Error('Conduit not initialized');
    }

    if (!isNil(conduit.admin)) {
      return;
    }

    const { database, config } = conduit;

    const databaseAdapter = database.getDbAdapter();

    this.registerSchemas(databaseAdapter);

    const AdminModel = databaseAdapter.getSchema('Admin');

    AdminModel.findOne({ username: 'admin' })
      .then((existing: any) => {
        if (isNil(existing)) {
          const hashRounds = config.get('admin.auth.hashRounds');
          return hashPassword('admin', hashRounds);
        }
        return Promise.resolve(null);
      })
      .then((result: string | null) => {
        if (!isNil(result)) {
          return AdminModel.create({ username: 'admin', password: result });
        }
      })
      .catch(console.log);

    app.post('/admin/login', (req, res, next) => loginAdmin(req, res, next).catch(next));
    app.use('/admin', this.authMiddleware, this.router);

    conduit.admin = this;
  }

  static getInstance(app?: Application) {
    if (AdminModule.instance === null) {
      if (isNil(app)) {
        throw new Error('No app was provided to initialize an instance');
      }
      AdminModule.instance = new AdminModule(app);
    }
    return AdminModule.instance;
  }

  private registerSchemas(adapter: any) {
    adapter.createSchemaFromAdapter(AdminSchema);
  }

  registerRoute(method: string, route: string, handler: Handler) {
    switch (method) {
      case 'GET':
        this.router.get(route, handler);
        break;
      case 'POST':
        this.router.post(route, handler);
        break;
      case 'PUT':
        this.router.put(route, handler);
        break;
      case 'DELETE':
        this.router.delete(route, handler);
        break;
      default:
        this.router.get(route, handler);
    }
  }

  authMiddleware(req: Request, res: Response, next: NextFunction) {
    const { conduit } = req.app as any;
    const { database, config } = conduit;

    const adminConfig = config.get('admin');

    const databaseAdapter = database.getDbAdapter();

    const AdminModel = databaseAdapter.getSchema('Admin');

    const tokenHeader = req.headers.authorization;
    if (isNil(tokenHeader)) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const args = tokenHeader.split(' ');
    if (args.length !== 2) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const [prefix, token] = args;
    if (prefix !== 'JWT') {
      return res.status(401).json({ error: 'The authorization header must begin with JWT' });
    }

    const decoded = verifyToken(token, adminConfig.auth.tokenSecret);
    const { id } = decoded;

    AdminModel.findOne({ _id: id })
      .then((admin: any) => {
        if (isNil(admin)) {
          return res.status(401).json({ error: 'No such user exists' });
        }
        (req as any).admin = admin;
        next();
      })
      .catch((error: Error) => {
        console.log(error);
        res.status(500).json({ error: 'Something went wrong' });
      });
  }
}

export = AdminModule;
