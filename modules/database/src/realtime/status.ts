import type { RealtimeStatus, RealtimeStatusCode } from './types.js';

export type RealtimeStatusInput = {
  engine: string;
  enabled: boolean;
  topologySupported: boolean;
  topologyMessage?: string;
  activeSchemaCount: number;
  streamState: RealtimeStatusCode;
  lastEventAt?: string;
  lastError?: string;
  socketsEnabled?: boolean;
};

export function buildRealtimeStatus(input: RealtimeStatusInput): RealtimeStatus {
  if (input.engine !== 'MongoDB') {
    return {
      status: 'unsupported',
      engine: input.engine,
      activeSchemaCount: 0,
      message: 'Live updates require MongoDB',
    };
  }
  if (!input.enabled) {
    return {
      status: 'disabled',
      engine: input.engine,
      activeSchemaCount: input.activeSchemaCount,
    };
  }
  if (!input.topologySupported) {
    return {
      status: 'idle',
      engine: input.engine,
      activeSchemaCount: input.activeSchemaCount,
      message:
        input.topologyMessage ??
        'A replica set or sharded MongoDB deployment is required for live updates',
    };
  }
  if (input.socketsEnabled === false) {
    return {
      status: 'idle',
      engine: input.engine,
      activeSchemaCount: input.activeSchemaCount,
      message:
        'Enable Admin socket transport to consume live updates in the control panel',
      lastEventAt: input.lastEventAt,
    };
  }
  if (input.activeSchemaCount === 0) {
    return {
      status: 'idle',
      engine: input.engine,
      activeSchemaCount: 0,
      message: 'No schemas have live updates enabled',
    };
  }
  if (input.streamState === 'degraded') {
    return {
      status: 'degraded',
      engine: input.engine,
      activeSchemaCount: input.activeSchemaCount,
      lastEventAt: input.lastEventAt,
      message: input.lastError ?? 'Change stream is retrying after an error',
    };
  }
  return {
    status: input.streamState,
    engine: input.engine,
    activeSchemaCount: input.activeSchemaCount,
    lastEventAt: input.lastEventAt,
  };
}
