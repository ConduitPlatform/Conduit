interface CrudOperation {
  enabled: boolean;
  authenticated: boolean;
}

const crudOperationDefaults: CrudOperation = {
  enabled: false,
  authenticated: false,
};

export interface ICms {
  authentication: false;
  enabled: true;

  crudOperations: {
    create: typeof crudOperationDefaults;
    read: typeof crudOperationDefaults;
    update: typeof crudOperationDefaults;
    delete: typeof crudOperationDefaults;
  };
}

export const cmsInstance: ICms = {
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
