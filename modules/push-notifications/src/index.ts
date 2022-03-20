import { ModuleManager } from '@conduitplatform/grpc-sdk';
import PushNotificationsModule from './PushNotifications';

const pushNotifications = new PushNotificationsModule();
const moduleManager = new ModuleManager(pushNotifications);
moduleManager.start();
