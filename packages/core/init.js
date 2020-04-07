const configModel = require('./models/ConfigModel');
const dbConfig = require('./utils/config/db-config');
const email = require('@conduit/email');
const security = require('@conduit/security');
const authentication = require('@conduit/authentication');
const AdminModule = require('@conduit/admin');
const PushNotificationsModule = require('@conduit/push-notifications');
const cms = require('@conduit/cms').CMS;
const usersRouter = require('./routes/users');
const { getConfig, editConfig } = require('./admin/config');

async function init(app) {
    await app.conduit.database.connectToDB(process.env.databaseType, process.env.databaseURL);
    registerSchemas(app.conduit.database);

    await dbConfig.configureFromDatabase(app);

    const admin = AdminModule.getInstance(app);

    if (!security.initialize(app)) {
        process.exit(9);
    }
    app.use(security.adminMiddleware);
    app.use(security.middleware);

    admin.registerBaseRoutes(app);
    registerAdminRoutes(admin);

    const pushNotificationsProviderName = app.conduit.config.get('pushNotifications.providerName');
    PushNotificationsModule.getInstance(
      app,
      pushNotificationsProviderName,
      app.conduit.config.get(`pushNotifications.${pushNotificationsProviderName}`));

    if (await email.initialize(app)) {
        app.conduit.email = email;
    }
    // authentication is always required, but adding this here as an example of how a module should be conditionally initialized
    if (app.conduit.config.get('authentication')) {
        await authentication.initialize(app, app.conduit.config.get('authentication'));
    }

    // initialize plugin AFTER the authentication so that we may provide access control to the plugins
    app.conduit.cms = new cms(app.conduit.database, app);

    app.use('/users', authentication.authenticate, usersRouter);
    app.initialized = true;
    return app;
}

function registerSchemas(database) {
    const db = database.getDbAdapter();
    db.createSchemaFromAdapter(configModel);
}

function registerAdminRoutes(admin) {
  admin.registerRoute('GET', '/config', (req, res, next) => getConfig(req, res, next).catch(next));
  admin.registerRoute('PUT', '/config', (req, res, next) => editConfig(req, res, next).catch(next));
}

module.exports = init;
