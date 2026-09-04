import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deleteOneLevelFolder } from './index.js';

type DeletedCall = { name: string; at: number };

function fileStub(name: string, deleted: DeletedCall[], fail?: boolean) {
  return {
    name,
    delete: async () => {
      if (fail) {
        throw new Error(`delete failed: ${name}`);
      }
      deleted.push({ name, at: deleted.length });
    },
  };
}

describe('deleteOneLevelFolder', () => {
  it('deletes only this folder objects, then markers, and pages results', async () => {
    const deleted: DeletedCall[] = [];
    const queries: Array<{ prefix?: string; delimiter?: string; autoPaginate?: boolean; pageToken?: string }> =
      [];

    const bucket = {
      getFiles: async (query: {
        prefix?: string;
        delimiter?: string;
        autoPaginate?: boolean;
        pageToken?: string;
      }) => {
        queries.push(query);
        if (!query.pageToken) {
          return [
            [
              fileStub('photos/a.jpg', deleted),
              fileStub('photos/vacation/a.jpg', deleted),
              fileStub('photos/.keep.txt', deleted),
            ],
            { pageToken: 'page-2' },
          ] as const;
        }
        return [[fileStub('photos/b.jpg', deleted)], undefined] as const;
      },
      file: (name: string) => fileStub(name, deleted),
    };

    const count = await deleteOneLevelFolder(bucket, 'photos/');

    assert.equal(count, 2);
    assert.deepEqual(
      deleted.map(entry => entry.name),
      ['photos/a.jpg', 'photos/b.jpg', 'photos/.keep.txt', 'photos/keep.txt'],
    );
    assert.ok(deleted[0].at < deleted[2].at);
    assert.equal(queries[0].prefix, 'photos/');
    assert.equal(queries[0].delimiter, '/');
    assert.equal(queries[0].autoPaginate, false);
    assert.equal(queries[1].pageToken, 'page-2');
  });

  it('leaves markers in place when an object delete fails so folderExists can retry', async () => {
    const deleted: DeletedCall[] = [];
    const bucket = {
      getFiles: async () =>
        [
          [fileStub('photos/a.jpg', deleted, true), fileStub('photos/.keep.txt', deleted)],
          undefined,
        ] as const,
      file: (name: string) => fileStub(name, deleted),
    };

    await assert.rejects(() => deleteOneLevelFolder(bucket, 'photos/'), /delete failed: photos\/a.jpg/);
    assert.deepEqual(
      deleted.map(entry => entry.name),
      [],
    );
  });
});
