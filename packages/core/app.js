var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var config = require('./utils/config/config.js');
var logger = require('./utils/logging/logger.js');
var authentication = require('@conduit/authentication');
var database = require('@conduit/database-provider');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger.logger());
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.config = config;
app.database = database;
database.connectToDB(process.env.databaseType, process.env.databaseURL);
// authentication is always required, but adding this here as an example of how a module should be conditionally initialized
if (config.get('authentication')) {
    authentication.initialize(app, config.get('authentication'));
}


app.use('/', indexRouter);
app.use('/users', authentication.authenticate, usersRouter);

app.use(logger.errorLogger());

app.use((error, req, res, next) => {
    let status = error.status;
    if (status === null || status === undefined) status = 500;
    res.status(status).json({error: error.message});
});

module.exports = app;
