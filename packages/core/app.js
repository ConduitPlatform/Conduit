var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var config = require('./utils/config.js');
var authentication = require('@conduit/authentication');


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.config = config;
// authentication is always required, but adding this here as an example of how a module should be conditionally initialized
if (config.get('authentication')) {
    authentication.initialize(app, config.get('authentication'));
}

app.use('/', indexRouter);
app.use(authentication.authenticate, '/users', usersRouter);


module.exports = app;
