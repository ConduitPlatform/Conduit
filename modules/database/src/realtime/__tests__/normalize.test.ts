import { describe, expect, it } from '@jest/globals';
import { ObjectId } from 'bson';
import { normalizeChangeEvent } from '../normalize.js';

describe('normalizeChangeEvent', () => {
  it('normalizes insert/update/replace/delete into metadata-only events', () => {
    const event = normalizeChangeEvent(
      {
        operationType: 'insert',
        documentKey: { _id: new ObjectId('64b64c4c4c4c4c4c4c4c4c4c') },
        fullDocument: { secret: 'nope' },
        wallTime: new Date('2026-01-01T00:00:00.000Z'),
      },
      'Order',
    );
    expect(event).toMatchObject({
      version: 1,
      operation: 'insert',
      schema: 'Order',
      documentId: '64b64c4c4c4c4c4c4c4c4c4c',
      occurredAt: '2026-01-01T00:00:00.000Z',
    });
    expect(event).not.toHaveProperty('resumeToken');
    expect(JSON.parse(JSON.stringify(event))).not.toHaveProperty('fullDocument');
  });

  it('ignores drop/invalidate and missing document ids', () => {
    expect(normalizeChangeEvent({ operationType: 'drop' }, 'Order')).toBeNull();
    expect(normalizeChangeEvent({ operationType: 'insert' }, 'Order')).toBeNull();
  });
});
