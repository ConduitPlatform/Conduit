import { ModuleManager } from '@conduitplatform/grpc-sdk';
import AuthorizationModule from './Authorization';
import { Config } from './config';

const authorization = new AuthorizationModule();
const moduleManager = new ModuleManager<Config>(authorization);
moduleManager.start();
