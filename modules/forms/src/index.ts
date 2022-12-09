import { ModuleManager } from '@conduitplatform/grpc-sdk';
import FormsModule from './Forms';
import { Config } from './config';
import path from 'path';

const forms = new FormsModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const migrationFilesPath = path.resolve(__dirname, 'migrations');
const moduleManager = new ModuleManager<Config>(
  forms,
  packageJsonPath,
  migrationFilesPath,
);
moduleManager.start();
