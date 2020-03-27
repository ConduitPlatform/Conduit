const path = require('path');
var convict = require('convict');
let schema = require('./config.schema');

// Define a schema
const config = convict(schema);

// Load environment dependent configuration
config.loadFile(path.join(__dirname,'../../config/env.json'));

// Perform validation
config.validate({allowed: 'strict'});

process.env.databaseType = config.get('database').type;
process.env.databaseURL = config.get('database').databaseURL;
process.env.googleClientId = config.get('authentication').google.clientId;
process.env.googleAccountLinking = config.get('authentication').google.accountLinking;
process.env.facebookAccountLinking = config.get('authentication').facebook.accountLinking;
process.env.jwtSecret = config.get('authentication').jwtSecret;
process.env.tokenInvalidationPeriod = config.get('authentication').tokenInvalidationPeriod;
process.env.refreshTokenInvalidationPeriod = config.get('authentication').refreshTokenInvalidationPeriod;

module.exports = config;
