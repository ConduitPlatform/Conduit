import { ModuleManager } from '@conduitplatform/grpc-sdk';
import { Config } from './config';
import ConduitDefaultRouter from './Router';

const router = new ConduitDefaultRouter();
const moduleManager = new ModuleManager<Config>(router);
moduleManager.start();
