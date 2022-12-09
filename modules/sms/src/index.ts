import { ModuleManager } from '@conduitplatform/grpc-sdk';
import SmsModule from './Sms';
import { Config } from './config';
import path from 'path';

const sms = new SmsModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const migrationFilesPath = path.resolve(__dirname, 'migrations');
const moduleManager = new ModuleManager<Config>(sms, packageJsonPath, migrationFilesPath);
moduleManager.start();
