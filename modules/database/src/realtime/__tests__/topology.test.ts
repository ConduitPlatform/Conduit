import { describe, expect, it } from '@jest/globals';
import {
  isResumeTokenUnusable,
  shouldRetryTopology,
  topologyFromHello,
} from '../topology.js';

describe('topology helpers', () => {
  it('accepts replica sets and mongos, rejects standalone', () => {
    expect(topologyFromHello({ setName: 'rs0' })).toEqual({ supported: true });
    expect(topologyFromHello({ msg: 'isdbgrid' })).toEqual({ supported: true });
    expect(topologyFromHello({}).supported).toBe(false);
  });

  it('detects unusable resume tokens', () => {
    expect(isResumeTokenUnusable({ code: 280 })).toBe(true);
    expect(isResumeTokenUnusable(new Error('cannot resume'))).toBe(true);
    expect(isResumeTokenUnusable(new Error('socket hang up'))).toBe(false);
  });

  it('retries Postgres topology failures and not unsupported engines', () => {
    expect(
      shouldRetryTopology({
        supported: false,
        retryable: true,
        message: 'PostgreSQL live updates require wal_level=logical',
      }),
    ).toBe(true);
    expect(
      shouldRetryTopology({
        supported: false,
        retryable: true,
        message: 'SQL live updates cannot reach the database: connect ECONNREFUSED',
      }),
    ).toBe(true);
    expect(
      shouldRetryTopology({
        supported: false,
        message: 'Unable to determine database topology',
      }),
    ).toBe(true);
    expect(
      shouldRetryTopology({
        supported: false,
        retryable: false,
        message:
          'Live updates are PostgreSQL WAL CDC only. MySQL, MariaDB, and SQLite are out of v1.',
      }),
    ).toBe(false);
    expect(shouldRetryTopology({ supported: true })).toBe(false);
  });
});
