import { ModuleManager } from '@conduitplatform/grpc-sdk';
import AuthenticationModule from './Authentication';
import { Config } from './config';
import path from 'path';

const authentication = new AuthenticationModule();
authentication.activateMigrations();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const moduleManager = new ModuleManager<Config>(authentication, packageJsonPath);
moduleManager.start();
