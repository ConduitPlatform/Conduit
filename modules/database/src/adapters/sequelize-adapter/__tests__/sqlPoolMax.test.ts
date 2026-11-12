import { describe, expect, it } from '@jest/globals';
import { createSequelize, DEFAULT_SQL_POOL_MAX, sqlPoolMax } from '../utils/sqlite.js';

describe('SQL connection pool size', () => {
  it.each([
    [undefined, DEFAULT_SQL_POOL_MAX],
    ['', DEFAULT_SQL_POOL_MAX],
    ['25', 25],
    ['0', DEFAULT_SQL_POOL_MAX],
    ['-3', DEFAULT_SQL_POOL_MAX],
    ['many', DEFAULT_SQL_POOL_MAX],
  ])('reads %p as %p', (value, expected) => {
    expect(sqlPoolMax(value)).toBe(expected);
  });

  it('is applied to the pool, unless the caller configures one', async () => {
    const byDefault = createSequelize('postgres://user@127.0.0.1:1/db');
    expect(byDefault.options.pool?.max).toBe(DEFAULT_SQL_POOL_MAX);
    await byDefault.close();

    const explicit = createSequelize('postgres://user@127.0.0.1:1/db', {
      pool: { max: 3 },
    });
    expect(explicit.options.pool?.max).toBe(3);
    await explicit.close();
  });
});
