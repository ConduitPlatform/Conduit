import { ModuleManager } from '@conduitplatform/grpc-sdk';
import StorageModule from './Storage';

const storage = new StorageModule();
const moduleManager = new ModuleManager(storage);
moduleManager.start();
