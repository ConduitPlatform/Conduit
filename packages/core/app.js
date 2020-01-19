var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var authentication = require('@conduit/authentication');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

authentication.initialize(app, {
    local: {
        identifier: 'email'
    }
});

app.use('/', indexRouter);
app.use(authentication.authenticate, '/users', usersRouter);

module.exports = app;
