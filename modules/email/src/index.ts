import { ModuleManager } from '@conduitplatform/grpc-sdk';
import EmailModule from './Email';
import { Config } from './config';

const email = new EmailModule();
const moduleManager = new ModuleManager<Config>(email);
moduleManager.start();
