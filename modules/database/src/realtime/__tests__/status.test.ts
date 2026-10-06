import { describe, expect, it } from '@jest/globals';
import { buildRealtimeStatus } from '../status.js';

describe('buildRealtimeStatus', () => {
  it('reports unsupported, disabled, idle, live, and degraded states', () => {
    expect(
      buildRealtimeStatus({
        engine: 'oracle',
        enabled: true,
        topologySupported: true,
        activeSchemaCount: 1,
        streamState: 'live',
      }).status,
    ).toBe('unsupported');
    expect(
      buildRealtimeStatus({
        engine: 'PostgreSQL',
        enabled: true,
        topologySupported: true,
        activeSchemaCount: 1,
        streamState: 'live',
      }).status,
    ).toBe('live');
    expect(
      buildRealtimeStatus({
        engine: 'mysql',
        enabled: true,
        topologySupported: true,
        activeSchemaCount: 1,
        streamState: 'live',
      }),
    ).toMatchObject({
      status: 'unsupported',
      message: 'Live updates are not supported for this database engine',
    });
    expect(
      buildRealtimeStatus({
        engine: 'sqlite',
        enabled: true,
        topologySupported: true,
        activeSchemaCount: 1,
        streamState: 'live',
      }).status,
    ).toBe('unsupported');
    expect(
      buildRealtimeStatus({
        engine: 'MongoDB',
        enabled: false,
        topologySupported: true,
        activeSchemaCount: 1,
        streamState: 'live',
      }).status,
    ).toBe('disabled');
    expect(
      buildRealtimeStatus({
        engine: 'MongoDB',
        enabled: true,
        topologySupported: false,
        activeSchemaCount: 1,
        streamState: 'idle',
      }).message,
    ).toMatch(/replica set/i);
    expect(
      buildRealtimeStatus({
        engine: 'PostgreSQL',
        enabled: true,
        topologySupported: false,
        topologyMessage:
          'PostgreSQL live updates require wal_level=logical (managed Postgres: enable logical replication / rds.logical_replication).',
        activeSchemaCount: 1,
        streamState: 'idle',
      }).message,
    ).toMatch(/wal_level=logical/);
    expect(
      buildRealtimeStatus({
        engine: 'PostgreSQL',
        enabled: true,
        topologySupported: false,
        activeSchemaCount: 1,
        streamState: 'idle',
      }).message,
    ).toMatch(/logical replication/i);
    expect(
      buildRealtimeStatus({
        engine: 'PostgreSQL',
        enabled: true,
        topologySupported: false,
        activeSchemaCount: 1,
        streamState: 'idle',
      }).message,
    ).not.toMatch(/change queue|LISTEN|trigger/i);
    expect(
      buildRealtimeStatus({
        engine: 'MongoDB',
        enabled: true,
        topologySupported: true,
        activeSchemaCount: 2,
        streamState: 'live',
      }).status,
    ).toBe('live');
    expect(
      buildRealtimeStatus({
        engine: 'MongoDB',
        enabled: true,
        topologySupported: true,
        activeSchemaCount: 1,
        streamState: 'degraded',
        lastError: 'boom',
      }),
    ).toMatchObject({ status: 'degraded', message: 'boom' });
  });
});
