import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { awsObjectGrantRead, buildPutObjectInput } from './index.js';

describe('AWS store object ACL', () => {
  it('does not GrantRead AllUsers for a public file in a private container', () => {
    assert.equal(
      awsObjectGrantRead({ fileIsPublic: true, containerIsPublic: false }),
      undefined,
    );
    assert.equal(buildPutObjectInput('bucket', 'key', 'body', { fileIsPublic: true }).GrantRead, undefined);
  });

  it('does not GrantRead AllUsers when only the file is public', () => {
    assert.equal(awsObjectGrantRead({ fileIsPublic: true }), undefined);
  });

  it('grants AllUsers read only when the container is public', () => {
    assert.equal(
      awsObjectGrantRead({ fileIsPublic: true, containerIsPublic: true }),
      'uri="http://acs.amazonaws.com/groups/global/AllUsers"',
    );
    assert.equal(
      buildPutObjectInput('bucket', 'key', 'body', {
        fileIsPublic: true,
        containerIsPublic: true,
      }).GrantRead,
      'uri="http://acs.amazonaws.com/groups/global/AllUsers"',
    );
  });
});
