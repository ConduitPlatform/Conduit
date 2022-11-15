import { ModuleManager } from '@conduitplatform/grpc-sdk';
import { Config } from './config';
import ConduitDefaultRouter from './Router';
import path from 'path';

const router = new ConduitDefaultRouter();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const moduleManager = new ModuleManager<Config>(router, packageJsonPath);
moduleManager.start();
