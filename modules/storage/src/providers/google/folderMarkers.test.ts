import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FOLDER_DELETE_PAGE_SIZE,
  folderListQuery,
  folderMarkerKeys,
  folderObjectPrefix,
  isDirectChildKey,
} from './index.js';

describe('GCS folder markers', () => {
  it('checks both the new name.keep.txt and legacy name/keep.txt keys', () => {
    assert.deepEqual(folderMarkerKeys('photos'), ['photos.keep.txt', 'photos/keep.txt']);
  });

  it('normalizes trailing slashes when looking up the legacy marker', () => {
    assert.deepEqual(folderMarkerKeys('photos/'), ['photos/.keep.txt', 'photos/keep.txt']);
  });
});

describe('GCS folder listing helpers', () => {
  it('normalizes the object prefix to a trailing slash', () => {
    assert.equal(folderObjectPrefix('photos'), 'photos/');
    assert.equal(folderObjectPrefix('photos/'), 'photos/');
  });

  it('treats only keys in the folder itself as direct children', () => {
    assert.equal(isDirectChildKey('photos/', 'photos/a.jpg'), true);
    assert.equal(isDirectChildKey('photos/', 'photos/.keep.txt'), true);
    assert.equal(isDirectChildKey('photos/', 'photos/vacation/a.jpg'), false);
    assert.equal(isDirectChildKey('photos/', 'photography/a.jpg'), false);
    assert.equal(isDirectChildKey('photos/', 'photos/'), false);
  });

  it('lists one folder page without recursing or auto-paginating', () => {
    assert.deepEqual(folderListQuery('photos'), {
      prefix: 'photos/',
      delimiter: '/',
      autoPaginate: false,
      maxResults: FOLDER_DELETE_PAGE_SIZE,
    });
    assert.deepEqual(folderListQuery('photos/', 'token-2'), {
      prefix: 'photos/',
      delimiter: '/',
      autoPaginate: false,
      maxResults: FOLDER_DELETE_PAGE_SIZE,
      pageToken: 'token-2',
    });
  });
});
