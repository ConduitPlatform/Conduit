import { ConduitBoolean, ConduitString } from '@conduitplatform/module-tools';

export const ConduitOptions = {
  cms: {
    crudOperations: {
      create: {
        enabled: ConduitBoolean.Optional,
        authenticated: ConduitBoolean.Optional,
      },
      read: {
        enabled: ConduitBoolean.Optional,
        authenticated: ConduitBoolean.Optional,
      },
      update: {
        enabled: ConduitBoolean.Optional,
        authenticated: ConduitBoolean.Optional,
      },
      delete: {
        enabled: ConduitBoolean.Optional,
        authenticated: ConduitBoolean.Optional,
      },
    },
  },
  permissions: {
    extendable: ConduitBoolean.Optional,
    canCreate: ConduitBoolean.Optional,
    canModify: ConduitString.Optional,
    canDelete: ConduitBoolean.Optional,
  },
  authorization: {
    enabled: ConduitBoolean.Optional,
  },
};
