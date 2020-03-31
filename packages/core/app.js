const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./utils/config/config.js');
const dbConfig = require('./utils/config/db-config');
const logger = require('./utils/logging/logger.js');
const authentication = require('@conduit/authentication');
const database = require('@conduit/database-provider');
const email = require('@conduit/email');
const cms = require('@conduit/cms').CMS;
const configModel = require('./models/ConfigModel');



const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');

async function init() {
    const app = express();

    app.use(logger.logger());
    app.use(express.json());
    app.use(express.urlencoded({extended: false}));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'public')));

// Obejct to contain all modules
    app.conduit = {};
    app.conduit.config = config;
    app.conduit.database = database;
    if (email.initialize(app)) {
        app.conduit.email = email;
    }

    await database.connectToDB(process.env.databaseType, process.env.databaseURL);
    registerSchemas(database);

    await dbConfig.configureFromDatabase(app);

// authentication is always required, but adding this here as an example of how a module should be conditionally initialized
    if (config.get('authentication')) {
        authentication.initialize(app, config.get('authentication'));
    }

// initialize plugin AFTER the authentication so that we may provide access control to the plugins
    app.conduit.cms = new cms(database, app);

    app.use('/', indexRouter);
    app.use('/users', authentication.authenticate, usersRouter);

    app.use(logger.errorLogger());

    app.use((error, req, res, next) => {
        let status = error.status;
        if (status === null || status === undefined) status = 500;
        res.status(status).json({error: error.message});
    });
    return app;
}

function registerSchemas(database) {
    const db = database.getDbAdapter();
    db.createSchemaFromAdapter(configModel);
}



module.exports = init;
