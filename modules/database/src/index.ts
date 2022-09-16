import { ModuleManager } from '@conduitplatform/grpc-sdk';
import DatabaseModule from './Database';

const dbType = process.env.DB_TYPE ?? 'mongodb';
const dbUri = process.env.DB_CONN_URI ?? 'mongodb://localhost:27017';

const database = new DatabaseModule(dbType, dbUri);
const moduleManager = new ModuleManager<void>(database);
moduleManager.start();
