import { ModuleManager } from "@conduitplatform/grpc-sdk";
import DatabaseModule from './Database';

const dbType = process.env.databaseType ?? 'mongodb';
const dbUrl = process.env.databaseURL ?? 'mongodb://localhost:27017';

const database = new DatabaseModule(dbType, dbUrl);
const moduleManager = new ModuleManager(database);
moduleManager.start();
