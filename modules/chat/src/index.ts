import { ModuleManager } from '@conduitplatform/grpc-sdk';
import ChatModule from './Chat';

const chat = new ChatModule();
const moduleManager = new ModuleManager(chat);
moduleManager.start();
