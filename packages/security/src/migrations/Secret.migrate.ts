import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import * as bcrypt from 'bcrypt';

export async function secretMigrate(grpcSdk: ConduitGrpcSdk) {
  let clients: {
    _id: string;
    clientSecret: string;
  }[] = await grpcSdk.databaseProvider!.findMany(
    'Client',
    {
      clientSecret: {
        $not: {
          $regex: '$2b.*',
        },
      },
    },
    'clientSecret'
  );
  if (clients.length === 0) return;
  for (let client of clients) {
    let hash = await bcrypt.hash(client.clientSecret, 10);
    await grpcSdk.databaseProvider!.findByIdAndUpdate(
      'Client',
      client._id,
      { clientSecret: hash },
      true
    );
  }
}
