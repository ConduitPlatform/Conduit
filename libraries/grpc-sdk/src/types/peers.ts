export type PeerWatchEdge = 'rising' | 'falling' | 'both';

export interface PeerWatchOptions {
  edge?: PeerWatchEdge;
  dedupe?: boolean;
  syncInitialState?: boolean;
}

export interface AwaitPeerOptions {
  onlyIfServing?: boolean;
  timeoutMs?: number;
}

export interface PeerWatchSpec {
  module: string;
  edge?: PeerWatchEdge;
}

export interface PeerWatchBatchOptions {
  debounceMs?: number;
  syncInitialState?: boolean;
}
