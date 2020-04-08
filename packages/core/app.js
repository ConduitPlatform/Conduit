require('./utils/monitoring/index').monitoring();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./utils/config/config.js');
const logger = require('./utils/logging/logger.js');
const database = require('@conduit/database-provider');
const init = require('./init');
const indexRouter = require('./routes/index');
const cors = require('cors');

let app = express();

app.use(cors());
app.use(logger.logger());
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Obejct to contain all modules
app.conduit = {};
app.conduit.config = config;
app.conduit.database = database;
app.initialized = false;

app.use('/', indexRouter);
app.use('/health', (req, res, next) => {
    if (app.initialized) {
        res.status(200).send('Conduit is online!');
    } else {
        res.status(500).send('Conduit is not active yet!');
    }

});

init(app);

app.use(logger.errorLogger());

app.use((error, req, res, next) => {
    let status = error.status;
    if (status === null || status === undefined) status = 500;
    res.status(status).json({error: error.message});
});

module.exports = app;
