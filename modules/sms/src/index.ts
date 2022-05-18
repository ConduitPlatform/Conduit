import { ModuleManager } from "@conduitplatform/grpc-sdk";
import SmsModule from './Sms';
import { Config } from './config';

const sms = new SmsModule();
const moduleManager = new ModuleManager<Config>(sms);
moduleManager.start();
