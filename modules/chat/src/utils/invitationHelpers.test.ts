import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateInvitationAnswer,
  buildLoginRedirectUrl,
  isAlreadyMember,
  replaceRoomIdInUri,
} from './invitationHelpers.js';
import {
  getMembershipCacheKey,
  MEMBERSHIP_CACHE_TTL_MS,
} from './membershipCache.js';

describe('invitationHelpers', () => {
  describe('validateInvitationAnswer', () => {
    it('accepts valid lowercase answers', () => {
      assert.doesNotThrow(() => validateInvitationAnswer('accept'));
      assert.doesNotThrow(() => validateInvitationAnswer('decline'));
    });

    it('rejects invalid answers including capitalized', () => {
      const invalidAnswers = ['Accept', 'ACCEPT', 'Decline', 'DECLINE', 'maybe', 'yes', 'no', ''];
      for (const answer of invalidAnswers) {
        assert.throws(
          () => validateInvitationAnswer(answer),
          {
            code: 3,
            message: 'Answer must be accept or decline',
          },
        );
      }
    });
  });

  describe('buildLoginRedirectUrl', () => {
    it('builds redirect URL with answer and invitationToken query params', () => {
      const url = buildLoginRedirectUrl(
        'https://app.example.com/login',
        'accept',
        'test-token-123',
      );
      assert.equal(
        url,
        'https://app.example.com/login?answer=accept&invitationToken=test-token-123',
      );
      assert.ok(!url.includes('redirectUri'));
    });

    it('handles trailing slash in login_uri', () => {
      const url = buildLoginRedirectUrl(
        'https://app.example.com/login/',
        'decline',
        'token-456',
      );
      assert.equal(
        url,
        'https://app.example.com/login/?answer=decline&invitationToken=token-456',
      );
    });

    it('throws FAILED_PRECONDITION when login_uri is empty', () => {
      assert.throws(
        () => buildLoginRedirectUrl('', 'accept', 'token'),
        {
          code: 9,
          message: 'Invitation login redirect is not configured',
        },
      );
    });

    it('throws FAILED_PRECONDITION when login_uri is relative', () => {
      const relativeUris = ['/login', 'login', '../login'];
      for (const uri of relativeUris) {
        assert.throws(
          () => buildLoginRedirectUrl(uri, 'accept', 'token'),
          {
            code: 9,
            message: 'login_uri must be an absolute URL',
          },
        );
      }
    });
  });

  describe('isAlreadyMember', () => {
    it('returns true when receiver is in participants using String comparison', () => {
      const participants = ['user1', 'user2', 'user3'];
      assert.equal(isAlreadyMember(participants, 'user2'), true);
    });

    it('returns false when receiver is not in participants', () => {
      const participants = ['user1', 'user2'];
      assert.equal(isAlreadyMember(participants, 'user3'), false);
    });

    it('uses String() for ObjectId compatibility', () => {
      const participants = [
        'user1',
        { toString: () => 'user2' },
        'user3',
      ];
      const receiver = { toString: () => 'user2' };
      assert.equal(isAlreadyMember(participants, receiver), true);
    });

    it('handles mixed string and ObjectId participants', () => {
      const participants = [
        'user1',
        { toString: () => 'user2' },
        'user3',
      ];
      assert.equal(isAlreadyMember(participants, 'user2'), true);
      assert.equal(isAlreadyMember(participants, 'user1'), true);
      assert.equal(isAlreadyMember(participants, 'user4'), false);
    });
  });

  describe('replaceRoomIdInUri', () => {
    it('replaces {roomId} placeholder in URI', () => {
      const uri = replaceRoomIdInUri('https://app.example.com/rooms/{roomId}', 'room123');
      assert.equal(uri, 'https://app.example.com/rooms/room123');
    });

    it('replaces multiple {roomId} occurrences', () => {
      const uri = replaceRoomIdInUri(
        'https://app.example.com/rooms/{roomId}/view?room={roomId}',
        'room456',
      );
      assert.equal(uri, 'https://app.example.com/rooms/room456/view?room=room456');
    });

    it('returns URI unchanged when no placeholder present', () => {
      const uri = replaceRoomIdInUri('https://app.example.com/rooms/static', 'room123');
      assert.equal(uri, 'https://app.example.com/rooms/static');
    });
  });
});

describe('membershipCache', () => {
  describe('getMembershipCacheKey', () => {
    it('constructs correct cache key format', () => {
      const key = getMembershipCacheKey('room123');
      assert.equal(key, 'chat:membership:room123');
    });

    it('handles different room IDs', () => {
      assert.equal(getMembershipCacheKey('abc'), 'chat:membership:abc');
      assert.equal(getMembershipCacheKey('507f1f77bcf86cd799439011'), 'chat:membership:507f1f77bcf86cd799439011');
    });
  });

  describe('MEMBERSHIP_CACHE_TTL_MS', () => {
    it('is set to 30 seconds', () => {
      assert.equal(MEMBERSHIP_CACHE_TTL_MS, 30 * 1000);
    });
  });
});
