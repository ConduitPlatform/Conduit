import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export const ChatMessageSchema = new ConduitSchema(
  'ChatMessage',
  {
    _id: TYPE.ObjectId,
    message: TYPE.String,
    senderUser: {
      type: TYPE.Relation,
      model: 'User'
    },
    room: {
      type: TYPE.Relation,
      model: 'ChatRoom'
    },
    readBy: [{
      type: TYPE.Relation,
      model: 'User',
      default: []
    }],
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
