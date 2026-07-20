import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { Functions } from '../models/index.js';
import { getCronPatternFromInputs } from '../controllers/cron.utils.js';

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  const cronFunctions = await Functions.getInstance().findMany({
    functionType: 'cron',
  });
  for (const func of cronFunctions) {
    const pattern = getCronPatternFromInputs(func.inputs);
    if (!pattern || func.inputs?.cronPattern) {
      continue;
    }
    await Functions.getInstance().findByIdAndUpdate(func._id, {
      inputs: {
        ...func.inputs,
        cronPattern: pattern,
      },
    });
    ConduitGrpcSdk.Logger.log(
      `Migrated cron function ${func.name} (${func._id}) to inputs.cronPattern`,
    );
  }
}
