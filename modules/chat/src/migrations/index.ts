import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { migrateChatRoom } from './chatRoom.migrate.js';
import { migrateChatMessages } from './chatMessage.migrate.js';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  await migrateChatRoom();
  await migrateChatMessages();
}
