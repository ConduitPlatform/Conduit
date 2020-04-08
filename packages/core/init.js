const configModel = require('./models/ConfigModel');
const dbConfig = require('./utils/config/db-config');
const email = require('@conduit/email');
const security = require('@conduit/security');
const authentication = require('@conduit/authentication');
const StorageModule = require('@conduit/storage');
const AdminModule = require('@conduit/admin');
const InMemoryStoreModule = require('@conduit/in-memory-store');
const PushNotificationsModule = require('@conduit/push-notifications');
const cms = require('@conduit/cms').CMS;
const usersRouter = require('./routes/users');
const {getConfig, editConfig} = require('./admin/config');

async function init(app) {

    registerSchemas(app.conduit.getDatabase());

    await dbConfig.configureFromDatabase(app.conduit.getDatabase(), app.conduit.config);

    app.conduit.registerAdmin(new AdminModule(app.conduit));
    registerAdminRoutes(app.conduit.getAdmin());

    if (!security.initialize(app)) {
        process.exit(9);
    }
    app.use(security.adminMiddleware);
    app.use(security.middleware);

    registerAdminRoutes(app.conduit.getAdmin());
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
    app.conduit.cms = new cms(app.conduit.getDatabase(), app);

    StorageModule.getInstance(app);

    const inMemoryStoreProviderName = app.conduit.config.get('inMemoryStore.providerName');
    InMemoryStoreModule.getInstance(
      app,
      inMemoryStoreProviderName,
      app.conduit.config.get(`inMemoryStore.settings.${inMemoryStoreProviderName}`));

    app.use('/users', authentication.authenticate, usersRouter);
    app.initialized = true;
    return app;
}

function registerSchemas(database) {
    database.createSchemaFromAdapter(configModel);
}

function registerAdminRoutes(admin) {
    admin.registerRoute('GET', '/config', (req, res, next) => getConfig(req, res, next).catch(next));
    admin.registerRoute('PUT', '/config', (req, res, next) => editConfig(req, res, next).catch(next));
}

module.exports = init;
