import { ConduitSchema, TYPE } from '@conduitplatform/grpc-sdk';

export const MigrationLogs = new ConduitSchema(
  'MigrationLogs',
  {
    _id: TYPE.ObjectId,
    migration: {
      type: TYPE.Relation,
      model: 'Migrations',
      required: true,
    },
    success: {
      type: TYPE.Boolean,
    },
    logs: {
      type: TYPE.JSON,
    },
  },
  {
    timestamps: true,
    conduit: {
      permissions: {
        extendable: true,
        canCreate: false,
        canModify: 'ExtensionOnly',
        canDelete: false,
      },
    },
  },
);
