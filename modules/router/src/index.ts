import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import ConduitDefaultRouter from './Router.js';

const peerManifestRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const router = new ConduitDefaultRouter(peerManifestRoot);

function registerShutdownSignals(): void {
  const shutdown = (signal: NodeJS.Signals) => {
    void router
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
router.start();
