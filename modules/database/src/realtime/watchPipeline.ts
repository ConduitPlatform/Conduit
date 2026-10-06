const DATA_OPERATIONS = ['insert', 'update', 'replace', 'delete'] as const;
const CONTROL_OPERATIONS = ['drop', 'rename', 'invalidate', 'dropDatabase'] as const;

export const WATCH_RESTART_OPERATIONS = new Set<string>(CONTROL_OPERATIONS);

export type WatchPipeline = Record<string, unknown>[];

export function buildWatchPipeline(collectionNames: string[]): WatchPipeline {
  return [
    {
      $match: {
        $or: [
          {
            operationType: { $in: [...DATA_OPERATIONS] },
            'ns.coll': { $in: collectionNames },
          },
          { operationType: { $in: [...CONTROL_OPERATIONS] } },
        ],
      },
    },
    {
      $project: {
        fullDocument: 0,
        updateDescription: 0,
        fullDocumentBeforeChange: 0,
      },
    },
  ];
}

export function optedInCollectionsKey(collectionNames: string[]): string {
  return [...collectionNames].sort().join('\0');
}
