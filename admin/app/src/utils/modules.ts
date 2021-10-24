import { IModule } from '../models/appAuth';

const modules = [
  'authentication',
  'email',
  'cms',
  'storage',
  'forms',
  'push-notifications',
  'sms',
  'chat',
  'payments',
  'database-provider',
];

export const getDisabledModules = (payloadModules: string[]) => {
  const disabledModules: IModule[] = [];
  modules.forEach((module) => {
    if (!payloadModules.includes(module)) {
      disabledModules.push({
        moduleName: module,
        url: '',
      });
    }
  });
  return disabledModules;
};

export const getSortedModules = (payloadModules: IModule[]) => {
  const sortedModules: IModule[] = [];
  modules.forEach((module) => {
    payloadModules.forEach((innerModule) => {
      if (module === innerModule.moduleName) sortedModules.push(innerModule);
    });
  });
  return sortedModules;
};
