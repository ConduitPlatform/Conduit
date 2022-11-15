import { ModuleManager } from '@conduitplatform/grpc-sdk';
import PushNotificationsModule from './PushNotifications';
import { Config } from './config';
import path from 'path';

const pushNotifications = new PushNotificationsModule();
const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const moduleManager = new ModuleManager<Config>(pushNotifications, packageJsonPath);
moduleManager.start();
