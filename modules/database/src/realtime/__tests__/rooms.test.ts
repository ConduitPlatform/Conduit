import { describe, expect, it } from '@jest/globals';
import {
  authorizedDocumentRoom,
  documentRoom,
  roomsForPublicChange,
  schemaRoom,
} from '../rooms.js';

describe('realtime rooms', () => {
  it('isolates schema, document, and per-user rooms', () => {
    expect(schemaRoom('Order')).toBe('database:schema:Order');
    expect(documentRoom('Order', 'abc')).toBe('database:doc:Order:abc');
    expect(authorizedDocumentRoom('Order', 'abc', 'user-1')).toBe(
      'database:doc:Order:abc:user:user-1',
    );
    expect(roomsForPublicChange('Order', 'abc')).toEqual([
      'database:schema:Order',
      'database:doc:Order:abc',
    ]);
    expect(schemaRoom('Order')).not.toBe(schemaRoom('Orders'));
    expect(authorizedDocumentRoom('Order', 'abc', 'u1')).not.toBe(
      authorizedDocumentRoom('Order', 'abc', 'u2'),
    );
  });

  it('encodes reserved characters so rooms cannot collide', () => {
    expect(schemaRoom('a/b')).toBe('database:schema:a%2Fb');
    expect(documentRoom('Order', 'id:1')).toBe('database:doc:Order:id%3A1');
  });
});
