import { GrpcRequest, GrpcResponse } from '@quintessential-sft/conduit-grpc-sdk';

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
