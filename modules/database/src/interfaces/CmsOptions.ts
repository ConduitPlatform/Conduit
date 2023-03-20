const crudOperationDefaults = {
  enabled: false,
  authenticated: false,
};

export interface CmsOptions {
  authentication: false;
  enabled: true;

  crudOperations: {
    create: typeof crudOperationDefaults;
    read: typeof crudOperationDefaults;
    update: typeof crudOperationDefaults;
    delete: typeof crudOperationDefaults;
  };
}

export const introspectedSchemaCmsOptionsDefaults: CmsOptions = {
  authentication: false,
  enabled: true,
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
