import { ModuleManager } from '@conduitplatform/grpc-sdk';
import EmailModule from './Email';

const email = new EmailModule();
const moduleManager = new ModuleManager(email);
moduleManager.start();
