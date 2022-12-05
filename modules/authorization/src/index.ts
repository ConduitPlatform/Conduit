import { ModuleManager } from '@conduitplatform/grpc-sdk';
import AuthorizationModule from './Authorization';
import { Config } from './config';
import path from 'path';

const authorization = new AuthorizationModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const moduleManager = new ModuleManager<Config>(authorization, packageJsonPath);
moduleManager.start();
