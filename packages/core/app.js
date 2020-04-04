require('./utils/monitoring/index').monitoring();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./utils/config/config.js');
const logger = require('./utils/logging/logger.js');
const database = require('@conduit/database-provider');
const conduitRouter = require('@conduit/router').ConduitRouter;
const conduitRouterBuilder = require('@conduit/router').router;
const init = require('./init');
const indexRouter = require('./routes/index');

let app = express();

app.use(express.static(path.join(__dirname, 'public')));

// Obejct to contain all modules
app.conduit = {};
app.conduit.router = conduitRouter.getInstance(app);
const router = app.conduit.router;
router.registerGlobalMiddleware('logger', logger.logger());
router.registerGlobalMiddleware('jsonParser', express.json());
router.registerGlobalMiddleware('urlEncoding', express.urlencoded({extended: false}));
router.registerGlobalMiddleware('cookieParser', cookieParser());
router.registerGlobalMiddleware('staticResources', express.static(path.join(__dirname, 'public')));

app.conduit.config = config;
app.conduit.database = database;
app.initialized = false;
router.registerExpressRouter('/', indexRouter);

router.registerDirectRouter('/health', (req, res, next) => {
    if (app.initialized) {
        res.status(200).send('Conduit is online!');
    } else {
        res.status(500).send('Conduit is not active yet!');
    }
});

init(app);
router.registerGlobalMiddleware('errorLogger', logger.errorLogger());
router.registerGlobalMiddleware('errorCatch', (error, req, res, next) => {
    let status = error.status;
    if (status === null || status === undefined) status = 500;
    res.status(status).json({error: error.message});
});

module.exports = app;
