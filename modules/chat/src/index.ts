import { ModuleManager } from '@conduitplatform/grpc-sdk';
import ChatModule from './Chat';
import path from 'path';

const chat = new ChatModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const migrationFilesPath = path.resolve(__dirname, 'migrations');
const moduleManager = new ModuleManager(chat, packageJsonPath, migrationFilesPath);
moduleManager.start();
