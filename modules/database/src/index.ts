import { ModuleManager } from '@conduitplatform/grpc-sdk';
import DatabaseModule from './Database';
import path from 'path';

const dbType = process.env.DB_TYPE ?? 'mongodb';
const dbUri = process.env.DB_CONN_URI ?? 'mongodb://localhost:27017';

const database = new DatabaseModule(dbType, dbUri);
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const migrationFilesPath = path.resolve(__dirname, 'migrations');
const moduleManager = new ModuleManager<void>(
  database,
  packageJsonPath,
  migrationFilesPath,
);
moduleManager.start();
