import { ModuleManager } from "@conduitplatform/grpc-sdk";
import AuthenticationModule from './Authentication';

const authentication = new AuthenticationModule();
const moduleManager = new ModuleManager(authentication);
moduleManager.start();
