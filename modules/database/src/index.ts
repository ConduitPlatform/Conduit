import DatabaseModule from './Database.js';

const dbType = process.env.DB_TYPE ?? 'mongodb';
const dbUri = process.env.DB_CONN_URI ?? 'mongodb://localhost:27017';

const database = new DatabaseModule(dbType, dbUri);
database.start();
