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
        enabled: false,
        topologySupported: true,
        activeSchemaCount: 1,
        streamState: 'live',
      }).status,
    ).toBe('disabled');
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
