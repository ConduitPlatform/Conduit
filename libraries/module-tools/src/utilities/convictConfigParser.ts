import { Indexable } from '@conduitplatform/grpc-sdk';

export const convictConfigParser = (config: Indexable) => {
  if (typeof config === 'object') {
    Object.keys(config).forEach(key => {
      if (key === '_cvtProperties') {
        config = convictConfigParser(config._cvtProperties);
      } else {
        config[key] = convictConfigParser(config[key]);
      }
    });
  }
  return config;
};
