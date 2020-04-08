const path = require('path');
var convict = require('convict');
let schema = require('./config.schema');

// Define a schema
const config = convict(schema);

// Load environment dependent configuration
config.loadFile(path.join(__dirname,'../../config/env.json'));

// Perform validation
config.validate({allowed: 'strict'});

if (process.env.DATABASE_TYPE) {
    process.env.databaseType = process.env.DATABASE_TYPE;
} else {
    process.env.DATABASE_TYPE = config.get('database').type;
}

if (process.env.DATABASE_URL) {
    process.env.databaseURL = process.env.DATABASE_URL;
} else {
    process.env.databaseURL = config.get('database').databaseURL;
}

module.exports = config;
