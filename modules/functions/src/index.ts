import { ModuleManager } from '@conduitplatform/grpc-sdk';
import { Config } from './config';
import FunctionsModule from './Functions';
const functions = new FunctionsModule();
const moduleManager = new ModuleManager<Config>(functions);
moduleManager.start();
