import { ConduitSchema, TYPE } from '@quintessential-sft/conduit-grpc-sdk';

export interface ActorFlowModel {
  _id: string;
  name: string;
  trigger: {
    code: string;
    name?: string;
    comments?: string;
    options: any;
  };
  actors: [
    {
      code: string;
      name: string;
      comments?: string;
      options: any;
    }
  ];
  actorPaths: [
    {
      actorName: string;
      destination: [string];
    }
  ];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ActorFlowSchema = new ConduitSchema(
  'ActorFlows',
  {
    _id: TYPE.ObjectId,
    name: {
      type: TYPE.String,
      required: true,
      unique: true,
      systemRequired: true,
    },
    trigger: {
      type: {
        code: TYPE.String,
        name: TYPE.String,
        comments: TYPE.String,
        options: TYPE.JSON,
      },
      required: true,
      systemRequired: true,
    },
    actors: {
      type: [
        {
          code: TYPE.String,
          name: TYPE.String,
          comments: TYPE.String,
          options: TYPE.JSON,
        },
      ],
      required: true,
      systemRequired: true,
    },
    enabled: {
      type: TYPE.Boolean,
      default: true,
    },
    createdAt: TYPE.Date,
    updatedAt: TYPE.Date,
  },
  {
    timestamps: true,
    systemRequired: true,
  }
);
