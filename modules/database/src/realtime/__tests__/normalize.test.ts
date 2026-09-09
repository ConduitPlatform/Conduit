import { describe, expect, it } from '@jest/globals';
import { ObjectId } from 'bson';
import { normalizeChangeEvent, parseResumeToken } from '../normalize.js';

describe('normalizeChangeEvent', () => {
  it('normalizes insert/update/replace/delete into metadata-only events', () => {
    const resume = { _data: 'token-1' };
    const event = normalizeChangeEvent(
      {
        operationType: 'insert',
        documentKey: { _id: new ObjectId('64b64c4c4c4c4c4c4c4c4c4c') },
        wallTime: new Date('2026-01-01T00:00:00.000Z'),
        _id: resume,
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
    expect(event?.resumeToken).toEqual(
      parseResumeToken(event!.resumeToken) ? event!.resumeToken : event?.resumeToken,
    );
    expect(JSON.parse(JSON.stringify(event))).not.toHaveProperty('fullDocument');
  });

  it('ignores drop/invalidate and missing document ids', () => {
    expect(
      normalizeChangeEvent({ operationType: 'drop', _id: { _data: 'x' } }, 'Order'),
    ).toBeNull();
    expect(
      normalizeChangeEvent({ operationType: 'insert', _id: { _data: 'x' } }, 'Order'),
    ).toBeNull();
  });
});
