const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const config = require('./utils/config/config.js');
const logger = require('./utils/logging/logger.js');
const database = require('@conduit/database-provider');
const init = require('./init');


let app = express();

app.use(logger.logger());
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Obejct to contain all modules
app.conduit = {};
app.conduit.config = config;
app.conduit.database = database;

init(app);

app.use(logger.errorLogger());

app.use((error, req, res, next) => {
  let status = error.status;
  if (status === null || status === undefined) status = 500;
  res.status(status).json({error: error.message});
});

module.exports = app;
