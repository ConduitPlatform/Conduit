import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { folderMarkerKeys } from './index.js';

describe('GCS folder markers', () => {
  it('checks both the new name.keep.txt and legacy name/keep.txt keys', () => {
    assert.deepEqual(folderMarkerKeys('photos'), ['photos.keep.txt', 'photos/keep.txt']);
  });

  it('normalizes trailing slashes when looking up the legacy marker', () => {
    assert.deepEqual(folderMarkerKeys('photos/'), ['photos/.keep.txt', 'photos/keep.txt']);
  });
});
