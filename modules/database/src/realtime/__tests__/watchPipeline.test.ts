import { describe, expect, it } from '@jest/globals';
import { buildWatchPipeline } from '../watchPipeline.js';

describe('buildWatchPipeline', () => {
  it('matches opted-in collections and projects out fullDocument', () => {
    const pipeline = buildWatchPipeline(['orders', 'items']);
    expect(pipeline[0]).toEqual({
      $match: {
        $or: [
          {
            operationType: { $in: ['insert', 'update', 'replace', 'delete'] },
            'ns.coll': { $in: ['orders', 'items'] },
          },
          {
            operationType: { $in: ['drop', 'rename', 'invalidate', 'dropDatabase'] },
          },
        ],
      },
    });
    expect(pipeline[1]).toEqual({
      $project: {
        fullDocument: 0,
        updateDescription: 0,
        fullDocumentBeforeChange: 0,
      },
    });
  });
});
