var convict = require('convict');
let schema = require('./config.schema');

// Define a schema
const config = convict(schema);

// Load environment dependent configuration
config.loadFile('../config/env.json');

// Perform validation
config.validate({allowed: 'strict'});

module.exports = config;
