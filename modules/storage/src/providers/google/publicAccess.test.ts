import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAllUsersObjectViewer,
  createGcsContainer,
  setBucketPublicAccess,
} from './index.js';

const OBJECT_VIEWER_ROLE = 'roles/storage.objectViewer';

describe('applyAllUsersObjectViewer', () => {
  it('adds an objectViewer allUsers binding when making a bucket public', () => {
    const updated = applyAllUsersObjectViewer({ bindings: [] }, true);
    assert.deepEqual(updated.bindings, [
      { role: OBJECT_VIEWER_ROLE, members: ['allUsers'] },
    ]);
  });

  it('treats missing bindings as an empty list', () => {
    const updated = applyAllUsersObjectViewer({}, true);
    assert.equal(updated.bindings?.[0]?.members.includes('allUsers'), true);
  });

  it('strips allUsers without dropping other objectViewer members', () => {
    const updated = applyAllUsersObjectViewer(
      {
        bindings: [
          { role: OBJECT_VIEWER_ROLE, members: ['allUsers', 'user:owner@example.com'] },
          { role: 'roles/storage.admin', members: ['user:admin@example.com'] },
        ],
      },
      false,
    );
    assert.deepEqual(updated.bindings, [
      { role: OBJECT_VIEWER_ROLE, members: ['user:owner@example.com'] },
      { role: 'roles/storage.admin', members: ['user:admin@example.com'] },
    ]);
  });
});

describe('setBucketPublicAccess', () => {
  it('grants IAM before enabling UBLA when making a bucket public', async () => {
    const calls: string[] = [];
    const bucket = {
      iam: {
        getPolicy: async () => {
          calls.push('getPolicy');
          return [{ bindings: [] }];
        },
        setPolicy: async () => {
          calls.push('setPolicy');
        },
      },
      getMetadata: async () => {
        calls.push('getMetadata');
        return [{ iamConfiguration: { uniformBucketLevelAccess: { enabled: false } } }];
      },
      setMetadata: async () => {
        calls.push('setMetadata');
      },
    };

    await setBucketPublicAccess(bucket, true);
    assert.deepEqual(calls, ['getPolicy', 'setPolicy', 'getMetadata', 'setMetadata']);
    assert.ok(calls.indexOf('setPolicy') < calls.indexOf('setMetadata'));
  });

  it('does not enable UBLA when making a bucket private', async () => {
    const calls: string[] = [];
    const bucket = {
      iam: {
        getPolicy: async () => [{ bindings: [] }],
        setPolicy: async () => {
          calls.push('setPolicy');
        },
      },
      getMetadata: async () => {
        calls.push('getMetadata');
        return [{}];
      },
      setMetadata: async () => {
        calls.push('setMetadata');
      },
    };

    await setBucketPublicAccess(bucket, false);
    assert.deepEqual(calls, ['setPolicy']);
  });
});

describe('createGcsContainer', () => {
  it('deletes a bucket it just created when public IAM setup fails', async () => {
    const calls: string[] = [];
    const storage = {
      createBucket: async () => {
        calls.push('createBucket');
      },
      bucket: () => ({
        iam: {
          getPolicy: async () => [{ bindings: [] }],
          setPolicy: async () => {
            calls.push('setPolicy');
            throw new Error('iam denied');
          },
        },
        getMetadata: async () => [{}],
        setMetadata: async () => {
          calls.push('setMetadata');
        },
        deleteFiles: async () => {
          calls.push('deleteFiles');
        },
        delete: async () => {
          calls.push('deleteBucket');
        },
      }),
    };

    await assert.rejects(() => createGcsContainer(storage, 'uploads', true), /iam denied/);
    assert.deepEqual(calls, ['createBucket', 'setPolicy', 'deleteFiles', 'deleteBucket']);
  });

  it('does not delete the bucket when setBucketPublicAccess is used on an existing bucket', async () => {
    const calls: string[] = [];
    const bucket = {
      iam: {
        getPolicy: async () => [{ bindings: [] }],
        setPolicy: async () => {
          throw new Error('iam denied');
        },
      },
      getMetadata: async () => [{}],
      setMetadata: async () => {},
      deleteFiles: async () => {
        calls.push('deleteFiles');
      },
      delete: async () => {
        calls.push('deleteBucket');
      },
    };

    await assert.rejects(() => setBucketPublicAccess(bucket, true), /iam denied/);
    assert.deepEqual(calls, []);
  });
});
