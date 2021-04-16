import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const ChatRoomSchema = new ConduitSchema(
  'ChatRoom',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
    },
    participants: [{
      type: TYPE.Relation,
      model: 'User'
    }],
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
