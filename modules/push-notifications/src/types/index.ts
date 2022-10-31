import { GrpcRequest, GrpcResponse } from '@conduitplatform/grpc-sdk';

export type SetNotificationTokenRequest = GrpcRequest<{
  token: string;
  platform: string;
  userId: string;
}>;

export type SetNotificationTokenResponse = GrpcResponse<{
  newTokenDocument: string;
}>;

export type GetNotificationTokensRequest = GrpcRequest<{
  userId: string;
}>;

export type GetNotificationTokensResponse = GrpcResponse<{
  tokenDocuments: string[];
}>;

export type SendNotificationRequest = GrpcRequest<{
  sendTo: string;
  title: string;
  body?: string;
  data?: string;
  type?: string;
  platform?: string;
}>;

export type SendToManyDevicesNotificationRequest = GrpcRequest<{
  sendTo: string[];
  title: string;
  body?: string;
  data?: string;
  type?: string;
  platform?: string;
}>;

export type SendManyNotificationsRequest = GrpcRequest<{
  notifications: [
    {
      sendTo: string;
      title: string;
      body?: string;
      data?: string;
      type?: string;
      platform?: string;
    },
  ];
}>;

export type SendNotificationResponse = GrpcResponse<{
  message: string;
}>;
