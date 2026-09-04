import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchQuery, parsePagination } from './search.js';

describe('parsePagination', () => {
  it('defaults skip and limit for the admin list', () => {
    assert.deepEqual(parsePagination(), { skip: 0, limit: 25 });
    assert.deepEqual(parsePagination(10, 5), { skip: 10, limit: 5 });
  });
});

describe('buildSearchQuery', () => {
  it('returns an empty query without search', () => {
    assert.deepEqual(buildSearchQuery(), {});
    assert.deepEqual(buildSearchQuery(''), {});
  });

  it('looks up ObjectIds exactly', () => {
    assert.deepEqual(buildSearchQuery('507f1f77bcf86cd799439011'), {
      _id: '507f1f77bcf86cd799439011',
    });
  });

  it('escapes regex metacharacters in name/channel search', () => {
    const query = buildSearchQuery('order.paid*');
    assert.deepEqual(query, {
      $or: [
        { name: { $regex: '.*order\\.paid\\*.*', $options: 'i' } },
        { busEvent: { $regex: '.*order\\.paid\\*.*', $options: 'i' } },
        { socketEvent: { $regex: '.*order\\.paid\\*.*', $options: 'i' } },
      ],
    });
  });
});
