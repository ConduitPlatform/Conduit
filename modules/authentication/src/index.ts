import { ModuleManager } from '@conduitplatform/grpc-sdk';
import AuthenticationModule from './Authentication';
import { Config } from './config';
import path from 'path';

const authentication = new AuthenticationModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const migrationFilesPath = path.resolve(__dirname, 'migrations', 'index');
const moduleManager = new ModuleManager<Config>(
  authentication,
  packageJsonPath,
  migrationFilesPath,
); // TODO: make the last 2 an object
moduleManager.start();
