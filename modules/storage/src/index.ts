import { ModuleManager } from '@conduitplatform/grpc-sdk';
import StorageModule from './Storage';
import { Config } from './config';

const storage = new StorageModule();
const moduleManager = new ModuleManager<Config>(storage);
moduleManager.start();
