import { ModuleManager } from '@conduitplatform/grpc-sdk';
import StorageModule from './Storage';
import { Config } from './config';
import path from 'path';

const storage = new StorageModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const moduleManager = new ModuleManager<Config>(storage, packageJsonPath);
moduleManager.start();
