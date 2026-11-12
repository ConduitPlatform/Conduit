import { describe, expect, it } from '@jest/globals';
import { isRetryableTransactionError } from '../errors.js';

describe('isRetryableTransactionError', () => {
  it.each([
    [
      'MongoDB transient transaction label',
      { errorLabels: ['TransientTransactionError'] },
    ],
    [
      'MongoDB driver error',
      { hasErrorLabel: (label: string) => label === 'TransientTransactionError' },
    ],
    ['PostgreSQL serialization failure', { original: { code: '40001' } }],
    ['PostgreSQL deadlock', { parent: { code: '40P01' } }],
    ['MySQL deadlock', { original: { code: 'ER_LOCK_DEADLOCK', errno: 1213 } }],
    ['SQLite busy', { original: { code: 'SQLITE_BUSY' } }],
  ])('retries on %s', (_name, error) => {
    expect(isRetryableTransactionError(error)).toBe(true);
  });

  it.each([
    ['nothing', undefined],
    ['a plain error', new Error('Document not found')],
    ['a unique violation', { original: { code: '23505' } }],
    ['an unknown commit result', { errorLabels: ['UnknownTransactionCommitResult'] }],
  ])('does not retry on %s', (_name, error) => {
    expect(isRetryableTransactionError(error)).toBe(false);
  });
});
