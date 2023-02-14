export interface CmsOptions {
  enabled: boolean;
  authentication: boolean;
  crudOperations: {
    [key: string]: {
      enabled: boolean;
      authenticated: boolean;
    };
  };
}

export const introspectedSchemaCmsOptionsDefaults: CmsOptions = {
  enabled: true,
  authentication: false,
  crudOperations: {
    create: {
      enabled: false,
      authenticated: false,
    },
    read: {
      enabled: false,
      authenticated: false,
    },
    update: {
      enabled: false,
      authenticated: false,
    },
    delete: {
      enabled: false,
      authenticated: false,
    },
  },
};
