const ConduitSDK = require("@conduit/sdk").ConduitSDK;

require('./utils/monitoring/index').monitoring();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./utils/config/config.js');
const logger = require('./utils/logging/logger.js');
const database = require('@conduit/database-provider').ConduitDefaultDatabase;
const conduitRouter = require('@conduit/router').ConduitDefaultRouter;
const init = require('./init');
const indexRouter = require('./routes/index');

let app = express();

app.use(express.static(path.join(__dirname, 'public')));

// Obejct to contain all modules
app.conduit = new ConduitSDK.getInstance(app);
app.conduit.config = config;
app.conduit.registerRouter(new conduitRouter(app));
const router = app.conduit.getRouter();
router.registerGlobalMiddleware('logger', logger.logger());
router.registerGlobalMiddleware('jsonParser', express.json());
router.registerGlobalMiddleware('urlEncoding', express.urlencoded({extended: false}));
router.registerGlobalMiddleware('cookieParser', cookieParser());
router.registerGlobalMiddleware('staticResources', express.static(path.join(__dirname, 'public')));

app.conduit.registerDatabase(new database(process.env.databaseType, process.env.databaseURL));
app.initialized = false;
router.registerExpressRouter('/', indexRouter);

router.registerDirectRouter('/health', (req, res, next) => {
    if (app.initialized) {
        res.status(200).send('Conduit is online!');
    } else {
        res.status(500).send('Conduit is not active yet!');
    }
});

init(app).then(r => {
    router.initGraphQL();
});

router.registerGlobalMiddleware('errorLogger', logger.errorLogger());
router.registerGlobalMiddleware('errorCatch', (error, req, res, next) => {
    let status = error.status;
    if (status === null || status === undefined) status = 500;
    res.status(status).json({error: error.message});
});

module.exports = app;
