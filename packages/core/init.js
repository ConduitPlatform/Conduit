const SecurityModule = require('@conduit/security');
const configModel = require('./models/ConfigModel');
const dbConfig = require('./utils/config/db-config');
const EmailModule = require('@conduit/email');
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

    // TODO commented this out so it doesnt interfere with convict values right now
    // await dbConfig.configureFromDatabase(app.conduit.getDatabase(), app.conduit.config);

    const config = app.conduit.config;

    if (config.get('admin.active')) {
        app.conduit.registerAdmin(new AdminModule(app.conduit));
    }

    app.conduit.registerSecurity(new SecurityModule(app.conduit));
    const security = app.conduit.getSecurity();
    app.use((req, res, next) => security.adminMiddleware(req, res, next));

    if (config.get('admin.active')) {
        app.use((req, res, next) => security.authMiddleware(req, res, next));
        registerAdminRoutes(app.conduit.getAdmin());
    }

    if (config.get('pushNotifications.active')) {
        const pushNotificationsProviderName = app.conduit.config.get('pushNotifications.providerName');
        app.conduit.registerPushNotifications(new PushNotificationsModule(
          app.conduit,
          pushNotificationsProviderName,
          app.conduit.config.get(`pushNotifications.${pushNotificationsProviderName}`)));
    }

    if (config.get('email.active')) {
        app.conduit.registerEmail(new EmailModule(app.conduit));
    }

    // authentication is always required, but adding this here as an example of how a module should be conditionally initialized
    if (app.conduit.config.get('authentication')) {
        await authentication.initialize(app, app.conduit.config.get('authentication'));
    }

    // initialize plugin AFTER the authentication so that we may provide access control to the plugins
    app.conduit.cms = new cms(app.conduit.getDatabase(), app);

    if (config.get('storage.active')) {
        app.conduit.registerStorage(new StorageModule(app.conduit));
    }

    if (config.get('inMemoryStore.active')){
        const inMemoryStoreProviderName = app.conduit.config.get('inMemoryStore.providerName');
        app.conduit.registerInMemoryStore(new InMemoryStoreModule(
          app.conduit,
          inMemoryStoreProviderName,
          app.conduit.config.get(`inMemoryStore.settings.${inMemoryStoreProviderName}`)));
    }

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
