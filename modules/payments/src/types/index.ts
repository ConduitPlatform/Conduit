import { GrpcRequest, GrpcResponse } from '@quintessential-sft/conduit-grpc-sdk';

export type CreateStripePaymentRequest = GrpcRequest<{
  productId: string;
  userId: string;
  saveCard: boolean;
}>;

export type CreateStripePaymentResponse = GrpcResponse<{
  clientSecret: string;
  paymentId: string;
}>;

export type CancelStripePaymentRequest = GrpcRequest<{
  paymentId: string;
  userId: string;
}>;

export type CancelStripePaymentResponse = GrpcResponse<{
  success: boolean;
}>;

export type RefundStripePaymentRequest = GrpcRequest<{
  paymentId: string;
  userId: string;
}>;

export type RefundStripePaymentResponse = GrpcResponse<{
  success: boolean;
}>;
