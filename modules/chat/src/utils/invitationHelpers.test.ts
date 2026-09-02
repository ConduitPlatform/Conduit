import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateInvitationAnswer,
  assertInvitationReceiver,
  buildInvitationHookUrl,
  buildLoginRedirectUrl,
  isAlreadyMember,
  replaceRoomIdInUri,
} from './invitationHelpers.js';
import {
  getMembershipCacheKey,
  MEMBERSHIP_CACHE_TTL_MS,
  invalidateMembershipCache,
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

    it('throws synchronously so invalid answers cannot burn tokens', () => {
      let deleted = false;
      const deleteTokens = () => {
        deleted = true;
      };
      try {
        validateInvitationAnswer('Accept');
        deleteTokens();
        assert.fail('Should have thrown before delete');
      } catch (err: any) {
        assert.equal(err.code, 3);
      }
      assert.equal(deleted, false);
    });
  });

  describe('assertInvitationReceiver', () => {
    it('allows the invitee including ObjectId-like values', () => {
      assert.doesNotThrow(() =>
        assertInvitationReceiver(
          '507f1f77bcf86cd799439011',
          { toString: () => '507f1f77bcf86cd799439011' },
        ),
      );
    });

    it('throws PERMISSION_DENIED (403) on invitee mismatch', () => {
      assert.throws(
        () => assertInvitationReceiver('user-a', 'user-b'),
        {
          code: 7,
          message: 'Invitation is not for the current user',
        },
      );
    });
  });

  describe('buildInvitationHookUrl', () => {
    it('matches email invitation hook paths', () => {
      assert.equal(
        buildInvitationHookUrl('https://api.example.com', 'accept', 'tok-1'),
        'https://api.example.com/hook/chat/invitations/accept/tok-1',
      );
      assert.equal(
        buildInvitationHookUrl('https://api.example.com/', 'decline', 'tok-2'),
        'https://api.example.com/hook/chat/invitations/decline/tok-2',
      );
    });
  });

  describe('buildLoginRedirectUrl', () => {
    const hookUrl = 'https://api.example.com/hook/chat/invitations/accept/test-token-123';

    it('includes redirectUri pointing back at the invitation hook', () => {
      const url = buildLoginRedirectUrl(
        'https://app.example.com/login',
        'accept',
        'test-token-123',
        hookUrl,
      );
      const parsed = new URL(url);
      assert.equal(parsed.origin + parsed.pathname, 'https://app.example.com/login');
      assert.equal(parsed.searchParams.get('redirectUri'), hookUrl);
      assert.equal(parsed.searchParams.get('answer'), 'accept');
      assert.equal(parsed.searchParams.get('invitationToken'), 'test-token-123');
    });

    it('builds the email to login to hook return loop from router hostUrl', () => {
      const returnHook = buildInvitationHookUrl(
        'https://api.example.com',
        'accept',
        'invite-token',
      );
      const url = buildLoginRedirectUrl(
        'https://app.example.com/login',
        'accept',
        'invite-token',
        returnHook,
      );
      assert.equal(
        new URL(url).searchParams.get('redirectUri'),
        'https://api.example.com/hook/chat/invitations/accept/invite-token',
      );
    });

    it('does not require or use token secret - only passes token to query param', () => {
      const url = buildLoginRedirectUrl(
        'https://app.example.com/login',
        'accept',
        'any-string-token',
        hookUrl,
      );
      assert.ok(url.includes('invitationToken=any-string-token'));
    });

    it('handles trailing slash in login_uri', () => {
      const url = buildLoginRedirectUrl(
        'https://app.example.com/login/',
        'decline',
        'token-456',
        'https://api.example.com/hook/chat/invitations/decline/token-456',
      );
      const parsed = new URL(url);
      assert.equal(parsed.pathname, '/login/');
      assert.equal(parsed.searchParams.get('answer'), 'decline');
      assert.equal(parsed.searchParams.get('invitationToken'), 'token-456');
      assert.equal(
        parsed.searchParams.get('redirectUri'),
        'https://api.example.com/hook/chat/invitations/decline/token-456',
      );
    });

    it('throws FAILED_PRECONDITION when login_uri is empty', () => {
      assert.throws(
        () => buildLoginRedirectUrl('', 'accept', 'token', hookUrl),
        {
          code: 9,
          message: 'Invitation login redirect is not configured',
        },
      );
    });

    it('throws FAILED_PRECONDITION when hook return URL is empty', () => {
      assert.throws(
        () => buildLoginRedirectUrl('https://app.example.com/login', 'accept', 'token', ''),
        {
          code: 9,
          message: 'Invitation hook return URL is required',
        },
      );
    });

    it('throws FAILED_PRECONDITION when login_uri is relative', () => {
      const relativeUris = ['/login', 'login', '../login'];
      for (const uri of relativeUris) {
        assert.throws(
          () => buildLoginRedirectUrl(uri, 'accept', 'token', hookUrl),
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

  describe('invalidateMembershipCache', () => {
    it('clears chat:membership:{roomId} on accept', async () => {
      const cleared: string[] = [];
      const grpcSdk = {
        state: {
          async clearKey(key: string): Promise<number> {
            cleared.push(key);
            return 1;
          },
        },
      };
      await invalidateMembershipCache(grpcSdk, 'room123');
      assert.deepEqual(cleared, ['chat:membership:room123']);
    });

    it('no-ops when state is missing', async () => {
      await invalidateMembershipCache({}, 'room123');
    });
  });

  describe('MEMBERSHIP_CACHE_TTL_MS', () => {
    it('is set to 30 seconds', () => {
      assert.equal(MEMBERSHIP_CACHE_TTL_MS, 30 * 1000);
    });
  });
});
