import { GrpcRequest, GrpcResponse } from '@conduitplatform/grpc-sdk';

export type SendSmsRequest = GrpcRequest<{
  to: string;
  message: string;
}>;

export type SendSmsResponse = GrpcResponse<{
  message: string;
}>;

export type SendVerificationCodeRequest = GrpcRequest<{
  to: string;
}>;

export type SendVerificationCodeResponse = GrpcResponse<{
  verificationSid: string;
}>;

export type VerifyRequest = GrpcRequest<{
  verificationSid: string;
  code: string;
}>;

export type VerifyResponse = GrpcResponse<{
  verified: boolean;
}>;
