import { ModuleManager } from '@conduitplatform/grpc-sdk';
import ChatModule from './Chat';
import path from 'path';

const chat = new ChatModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const moduleManager = new ModuleManager(chat, packageJsonPath);
moduleManager.start();
