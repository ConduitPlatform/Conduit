import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const VerificationRecordSchema = new ConduitSchema('VerificationRecord', {
  _id: TYPE.ObjectId,
  userId: {
    type: TYPE.Relation,
    model: 'User',
    systemRequired: true,
  },
  clientId: {
    type: TYPE.String,
    required: true,
    systemRequired: true,
  },
  verificationSid: {
    type: TYPE.String,
    required: true,
    systemRequired: true,
  },
  phoneNumber: TYPE.String,
  expiresOn: TYPE.Date,
  createdAt: TYPE.Date,
  updatedAt: TYPE.Date,
});
