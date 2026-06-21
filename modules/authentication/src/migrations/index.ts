import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { User } from '../models/index.js';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  if (!grpcSdk.database) {
    return;
  }
  const userModel = User.getInstance(grpcSdk.database);
  await userModel.updateMany({ twoFaMethod: 'phone' }, { twoFaMethod: 'sms' });
}
