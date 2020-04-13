require('./utils/monitoring/index').monitoring();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./utils/config/config.js');
const logger = require('./utils/logging/logger.js');
const ConduitSDK = require("@conduit/sdk").ConduitSDK;
const ConduitRoute = require("@conduit/sdk").ConduitRoute;
const Actions = require("@conduit/sdk").ConduitRouteActions;
const ReturnDefinition = require("@conduit/sdk").ConduitRouteReturnDefinition;
const database = require('@conduit/database-provider').ConduitDefaultDatabase;
const conduitRouter = require('@conduit/router').ConduitDefaultRouter;
const init = require('./init');
const indexRouter = require('./routes/index');
const cors = require('cors');

let app = express();

// Object to contain all modules
app.conduit = new ConduitSDK.getInstance(app);
app.conduit.config = config;
app.conduit.registerRouter(new conduitRouter(app));

const router = app.conduit.getRouter();
router.registerGlobalMiddleware('cors', cors());
router.registerGlobalMiddleware('logger', logger.logger());
router.registerGlobalMiddleware('jsonParser', express.json());
router.registerGlobalMiddleware('urlEncoding', express.urlencoded({extended: false}));
router.registerGlobalMiddleware('cookieParser', cookieParser());
router.registerGlobalMiddleware('staticResources', express.static(path.join(__dirname, 'public')));

app.conduit.registerDatabase(new database(process.env.databaseType, process.env.databaseURL));
app.initialized = false;
router.registerExpressRouter('/', indexRouter);

router.initGraphQL();
router.registerRoute(new ConduitRoute({
    path: '/health',
    action: Actions.GET,
    queryParams: {
        shouldCheck: 'String'
    }
}, new ReturnDefinition('HealthResult', 'String'), (params) => {
    return new Promise(((resolve, reject) => {
        if (app.initialized) {
            resolve('Conduit is online!')
        } else {
            throw new Error('Conduit is not active yet!');
        }
    }))
}));

init(app);

router.registerGlobalMiddleware('errorLogger', logger.errorLogger());
router.registerGlobalMiddleware('errorCatch', (error, req, res, next) => {
    let status = error.status;
    if (status === null || status === undefined) status = 500;
    res.status(status).json({error: error.message});
});

module.exports = app;
