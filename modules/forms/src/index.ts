import { ModuleManager } from "@conduitplatform/grpc-sdk";
import FormsModule from './Forms';

const forms = new FormsModule();
const moduleManager = new ModuleManager(forms);
moduleManager.start();
