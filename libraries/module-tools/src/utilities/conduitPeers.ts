import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PeerWatchEdge } from '@conduitplatform/grpc-sdk';

export interface ConduitPeerWatchEntry {
  module: string;
  edge?: PeerWatchEdge;
}

/** Optional `conduit.peers` block in a module `package.json`. */
export interface ConduitPeersManifest {
  peers?: {
    await?: string[];
    watch?: ConduitPeerWatchEntry[];
  };
}

export interface ConduitPackageJson {
  name?: string;
  conduit?: ConduitPeersManifest;
}

export function readConduitPeersManifest(
  moduleRootDir: string = process.cwd(),
): ConduitPeersManifest | null {
  const pkgPath = path.join(moduleRootDir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as ConduitPackageJson;
    if (!pkg.conduit?.peers) return null;
    return pkg.conduit;
  } catch (e) {
    console.warn(`[conduitPeers] Failed to parse ${pkgPath}: ${(e as Error).message}`);
    return null;
  }
}
