import { GrpcRequest, GrpcResponse } from '@conduitplatform/grpc-sdk';

export type CreateRoomRequest = GrpcRequest<{
  name: string;
  participants: string[];
}>

export type RoomResponse = GrpcResponse<{
  result: string;
}>

export type SendMessageRequest = GrpcRequest<{
  userId: string;
  roomId: string;
  message: string;
}>


