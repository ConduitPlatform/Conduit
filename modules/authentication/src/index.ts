import { ModuleManager } from '@conduitplatform/grpc-sdk';
import AuthenticationModule from './Authentication';
import { Config } from './config';

const authentication = new AuthenticationModule();
const moduleManager = new ModuleManager<Config>(authentication);
moduleManager.start();
