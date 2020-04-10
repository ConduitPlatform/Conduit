const path = require('path');
var convict = require('convict');
let schema = require('./config.schema');
const inMemoryStoreSchema = require('./in-memory-store-config.schema');
const storageSchema = require('./storage-config.schema');

// Define a schema
schema = Object.assign(schema, storageSchema);
schema = Object.assign(schema, inMemoryStoreSchema);
const config = convict(schema);

console.log(config);

// Load environment dependent configuration
config.loadFile(path.join(__dirname,'../../config/env.json'));

// Perform validation
config.validate({allowed: 'strict'});

if (process.env.DATABASE_TYPE) {
    process.env.databaseType = process.env.DATABASE_TYPE;
} else {
    process.env.databaseType = config.get('database').type;
}

if (process.env.DATABASE_URL) {
    process.env.databaseURL = process.env.DATABASE_URL;
} else {
    process.env.databaseURL = config.get('database').databaseURL;
}

module.exports = config;
