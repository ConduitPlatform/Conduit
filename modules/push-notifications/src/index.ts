import { ModuleManager } from '@conduitplatform/grpc-sdk';
import PushNotificationsModule from './PushNotifications';
import { Config } from './config';

const pushNotifications = new PushNotificationsModule();
const moduleManager = new ModuleManager<Config>(pushNotifications);
moduleManager.start();
