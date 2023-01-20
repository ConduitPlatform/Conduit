import { ModuleManager } from '@conduitplatform/grpc-sdk';
import AuthenticationModule from './Authentication';
import { Config } from './config';
import path from 'path';

const authentication = new AuthenticationModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const migrationFilePath = path.resolve(__dirname, 'migrations');
const moduleManager = new ModuleManager<Config>(
  authentication,
  packageJsonPath,
  migrationFilePath,
);
moduleManager.start();
