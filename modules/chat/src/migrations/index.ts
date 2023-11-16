import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { migrateChatRoom } from './chatRoom.migrate';
import { migrateChatMessages } from './chatMessage.migrate';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await migrateChatRoom();
  await migrateChatMessages();
}
