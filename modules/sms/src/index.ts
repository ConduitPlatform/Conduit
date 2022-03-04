import { ModuleManager } from "@conduitplatform/grpc-sdk";
import SmsModule from './Sms';

const sms = new SmsModule();
const moduleManager = new ModuleManager(sms);
moduleManager.start();
