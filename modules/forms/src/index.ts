import { ModuleManager } from '@conduitplatform/grpc-sdk';
import FormsModule from './Forms';
import { Config } from './config';

const forms = new FormsModule();
const moduleManager = new ModuleManager<Config>(forms);
moduleManager.start();
