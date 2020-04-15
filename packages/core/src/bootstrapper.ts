import { App } from './app';
import { ConduitApp } from './interfaces/ConduitApp';
import { ConfigModel } from './models/Config';
import { DatabaseConfigUtility } from './utils/config';
import { Config } from 'convict';
import AdminModule from '@conduit/admin';
import SecurityModule from '@conduit/security';
import PushNotificationsModule from '@conduit/push-notifications';
import EmailModule from '@conduit/email';
import AuthenticationModule from '@conduit/authentication';
import { CMS } from '@conduit/cms';
import StorageModule from '@conduit/storage';
import InMemoryStoreModule from '@conduit/in-memory-store';

export class ConduitBootstrapper {
  static bootstrap() {
    const app = new App().get();



    return app;
  }

  private static registerSchemas(app: ConduitApp) {
    const database = app.conduit.getDatabase();
    database.createSchemaFromAdapter(ConfigModel);
  }

  private static registerAdminRoutes(app: ConduitApp) {
    const admin = app.conduit.getAdmin();

    admin.registerRoute('GET', '/config', (req, res, next) => getConfig(req, res, next).catch(next));
    admin.registerRoute('PUT', '/config', (req, res, next) => editConfig(req, res, next).catch(next));
  }

  private static async bootstrapSdkComponents(app: ConduitApp) {
    ConduitBootstrapper.registerSchemas(app);

    const database = app.conduit.getDatabase();
    const appConfig: Config<any> = (app.conduit as any).config;

    const databaseConfigUtility = new DatabaseConfigUtility(database, appConfig);

    await databaseConfigUtility.configureFromDatabase();

    app.conduit.registerAdmin(new AdminModule(app.conduit));

    app.conduit.registerSecurity(new SecurityModule(app.conduit));
    const security = app.conduit.getSecurity();

    registerAdminRoutes(app.conduit.getAdmin());

    if (appConfig.get('pushNotifications.active')) {
      app.conduit.registerPushNotifications(new PushNotificationsModule(app.conduit));
    }

    if (appConfig.get('email.active')) {
      app.conduit.registerEmail(new EmailModule(app.conduit));
    }

    // authentication is always required, but adding this here as an example of how a module should be conditionally initialized
    if (appConfig.get('authentication.active')) {
      const authenticationModule = new AuthenticationModule(app.conduit);
      app.conduit.registerAuthentication(authenticationModule);
      app.use('/users', authenticationModule.middleware, usersRouter);
    }

    // initialize plugin AFTER the authentication so that we may provide access control to the plugins
    (app.conduit as any).cms = new CMS(database, app);

    if (appConfig.get('storage.active')) {
      app.conduit.registerStorage(new StorageModule(app.conduit));
    }

    if (appConfig.get('inMemoryStore.active')) {
      app.conduit.registerInMemoryStore(new InMemoryStoreModule(app.conduit));
    }

    app.initialized = true;
  }
}
