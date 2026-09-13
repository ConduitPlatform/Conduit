import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import DatabaseModule from './Database.js';

const dbType = process.env.DB_TYPE ?? 'mongodb';
const dbUri = process.env.DB_CONN_URI ?? 'mongodb://localhost:27017';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const database = new DatabaseModule(dbType, dbUri, peerManifestRoot);

function registerShutdownSignals(): void {
  const shutdown = (signal: NodeJS.Signals) => {
    void database
      .shutdown()
      .catch(err => {
        ConduitGrpcSdk.Logger.error(err as Error);
      })
      .finally(() => {
        process.exit(signal === 'SIGINT' ? 130 : 0);
      });
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

registerShutdownSignals();
database.start();
