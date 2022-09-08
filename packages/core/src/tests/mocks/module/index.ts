import { ModuleManager } from '@conduitplatform/grpc-sdk';
import TestModule from './TestModule';

const test = new TestModule();
const moduleManager = new ModuleManager(test);
moduleManager.start();
