import { describe, expect, it } from '@jest/globals';
import { isResumeTokenUnusable, topologyFromHello } from '../topology.js';

describe('topology helpers', () => {
  it('accepts replica sets and mongos, rejects standalone', () => {
    expect(topologyFromHello({ setName: 'rs0' })).toEqual({ supported: true });
    expect(topologyFromHello({ msg: 'isdbgrid' })).toEqual({ supported: true });
    expect(topologyFromHello({}).supported).toBe(false);
  });

  it('detects unusable resume tokens', () => {
    expect(isResumeTokenUnusable({ code: 280 })).toBe(true);
    expect(isResumeTokenUnusable({ code: 237 })).toBe(false);
    expect(isResumeTokenUnusable({ code: 136 })).toBe(false);
    expect(isResumeTokenUnusable(new Error('ChangeStreamHistoryLost'))).toBe(true);
    expect(isResumeTokenUnusable(new Error('cannot resume'))).toBe(false);
    expect(isResumeTokenUnusable(new Error('socket hang up'))).toBe(false);
  });
});
