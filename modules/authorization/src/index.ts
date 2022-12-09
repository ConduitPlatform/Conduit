import { ModuleManager } from '@conduitplatform/grpc-sdk';
import AuthorizationModule from './Authorization';
import { Config } from './config';
import path from 'path';

const authorization = new AuthorizationModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const migrationFilesPath = path.resolve(__dirname, 'migrations');
const moduleManager = new ModuleManager<Config>(
  authorization,
  packageJsonPath,
  migrationFilesPath,
);
moduleManager.start();
