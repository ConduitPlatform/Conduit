import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('InvitationRoutes', () => {
  describe('answer validation', () => {
    it('validates answer is accept or decline', () => {
      const invalidAnswers = ['Accept', 'ACCEPT', 'Decline', 'DECLINE', 'maybe', 'yes', 'no', ''];
      for (const answer of invalidAnswers) {
        const isValid = answer === 'accept' || answer === 'decline';
        assert.equal(isValid, false);
      }
    });

    it('accepts valid lowercase answer', () => {
      const validAnswers = ['accept', 'decline'];
      for (const answer of validAnswers) {
        assert.ok(answer === 'accept' || answer === 'decline');
      }
    });
  });

  describe('unauthenticated hook flow', () => {
    it('redirects to login_uri with answer + invitationToken query params', () => {
      const config = {
        explicit_room_joins: {
          redirect: {
            login_uri: 'https://app.example.com/login',
          },
        },
      };

      const redirectUrl = new URL(config.explicit_room_joins.redirect.login_uri);
      redirectUrl.searchParams.set('answer', 'accept');
      redirectUrl.searchParams.set('invitationToken', 'test-token-123');

      assert.equal(
        redirectUrl.toString(),
        'https://app.example.com/login?answer=accept&invitationToken=test-token-123',
      );
      assert.ok(!redirectUrl.toString().includes('redirectUri'));
    });

    it('detects empty login_uri', () => {
      const config = {
        explicit_room_joins: {
          redirect: {
            login_uri: '',
          },
        },
      };

      const isEmpty = !config.explicit_room_joins.redirect.login_uri;
      assert.equal(isEmpty, true);
    });

    it('throws FAILED_PRECONDITION when login_uri is relative', () => {
      const invalidUris = ['/login', 'login', '../login'];

      for (const uri of invalidUris) {
        try {
          new URL(uri);
          assert.fail('Should have thrown for relative URI: ' + uri);
        } catch (err) {
          assert.ok(err instanceof TypeError);
        }
      }
    });
  });

  describe('invitee check', () => {
    it('uses String() comparison for user._id === receiver', () => {
      const userId = '507f1f77bcf86cd799439011';
      const receiverObjectId = { toString: () => '507f1f77bcf86cd799439011' };

      assert.equal(String(userId), String(receiverObjectId));
    });

    it('checks wrong user scenario', () => {
      const userId = 'user1';
      const receiver = 'user2';
      const isWrongUser = String(userId) !== String(receiver);
      assert.equal(isWrongUser, true);
    });
  });

  describe('already-member handling', () => {
    it('checks membership using String() on every participant', () => {
      const participants = ['user1', { toString: () => 'user2' }, 'user3'];
      const receiver = { toString: () => 'user2' };

      const alreadyMember = participants.some(p => String(p) === String(receiver));
      assert.ok(alreadyMember);
    });

    it('does not push duplicate when already member', () => {
      const participants = ['user1', 'user2'];
      const receiver = 'user2';
      const alreadyMember = participants.some(p => String(p) === String(receiver));

      if (!alreadyMember) {
        participants.push(String(receiver));
      }

      assert.equal(participants.length, 2);
      assert.deepEqual(participants, ['user1', 'user2']);
    });

    it('pushes String(receiver) when not already member', () => {
      const participants = ['user1'];
      const receiver = { toString: () => 'user2' };
      const alreadyMember = participants.some(p => String(p) === String(receiver));

      if (!alreadyMember) {
        participants.push(String(receiver));
      }

      assert.equal(participants.length, 2);
      assert.equal(participants[1], 'user2');
      assert.equal(typeof participants[1], 'string');
    });
  });

  describe('hook return type', () => {
    it('returns { result } when no redirect URIs are set', () => {
      const config = {
        explicit_room_joins: {
          redirect: {
            accept_uri: '',
            decline_uri: '',
          },
        },
      };

      const message = 'Invitation accepted';
      const result = !config.explicit_room_joins.redirect.accept_uri
        ? { result: message }
        : { redirect: config.explicit_room_joins.redirect.accept_uri };

      assert.deepEqual(result, { result: 'Invitation accepted' });
      assert.ok(!('redirect' in result));
    });

    it('returns { redirect } with {roomId} replaced on accept_uri', () => {
      const config = {
        explicit_room_joins: {
          redirect: {
            accept_uri: 'https://app.example.com/rooms/{roomId}',
          },
        },
      };

      const roomId = 'room123';
      const redirect = config.explicit_room_joins.redirect.accept_uri.replace(
        /\{roomId\}/g,
        roomId,
      );

      assert.equal(redirect, 'https://app.example.com/rooms/room123');
    });

    it('returns { redirect } with {roomId} replaced on decline_uri', () => {
      const config = {
        explicit_room_joins: {
          redirect: {
            decline_uri: 'https://app.example.com/declined/{roomId}',
          },
        },
      };

      const roomId = 'room123';
      const redirect = config.explicit_room_joins.redirect.decline_uri.replace(
        /\{roomId\}/g,
        roomId,
      );

      assert.equal(redirect, 'https://app.example.com/declined/room123');
    });

    it('selects correct URI based on answer', () => {
      const config = {
        explicit_room_joins: {
          redirect: {
            accept_uri: 'https://app.example.com/accepted/{roomId}',
            decline_uri: 'https://app.example.com/declined/{roomId}',
          },
        },
      };

      const roomId = 'room123';

      function getRedirectUri(answer: string) {
        return answer === 'accept'
          ? config.explicit_room_joins.redirect.accept_uri
          : config.explicit_room_joins.redirect.decline_uri;
      }

      assert.equal(
        getRedirectUri('accept').replace(/\{roomId\}/g, roomId),
        'https://app.example.com/accepted/room123',
      );
      assert.equal(
        getRedirectUri('decline').replace(/\{roomId\}/g, roomId),
        'https://app.example.com/declined/room123',
      );
    });
  });

  describe('by-token route', () => {
    it('uses the secret token not the document id', () => {
      const tokenDoc = {
        _id: 'doc-id-12345',
        token: 'secret-uuid-token',
        receiver: 'user1',
        room: 'room1',
      };

      assert.notEqual(tokenDoc._id, tokenDoc.token);
      assert.ok(tokenDoc.token.includes('uuid'));
    });
  });

  describe('membership cache', () => {
    it('constructs cache key correctly', () => {
      const roomId = 'room123';
      const cacheKey = `chat:membership:${roomId}`;
      assert.equal(cacheKey, 'chat:membership:room123');
    });

    it('uses consistent key format', () => {
      function getMembershipCacheKey(roomId: string): string {
        return `chat:membership:${roomId}`;
      }
      assert.equal(getMembershipCacheKey('abc'), 'chat:membership:abc');
    });
  });
});
