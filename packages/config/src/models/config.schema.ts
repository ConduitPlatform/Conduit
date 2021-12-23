import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-commons';

export default new ConduitSchema(
  'Config',
  {
    _id: TYPE.ObjectId,
    moduleConfigs: {
      type: TYPE.JSON,
      default: {},
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
  }
);
