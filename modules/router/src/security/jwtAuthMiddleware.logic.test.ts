import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import {
  createAuthModeToggle,
  createSocketRecoveryCheck,
  throttledLogger,
  jwtAuthenticate,
  JwtAuthDeps,
} from './jwtAuthMiddleware.logic.js';

const claims = (over: any = {}) => ({
  sub: 'u1',
  sid: 's1',
  cid: 'c1',
  authorized: true,
  sudo: false,
  tv: 1,
  iat: 0,
  exp: 9,
  iss: 'x',
  ...over,
});

function setup(
  opts: {
    strict?: boolean;
    claims?: any;
    exists?: boolean | Error;
    verifyError?: any;
  } = {},
) {
  const calls: any = { verify: [], exists: [], warn: [] };
  const deps: JwtAuthDeps = {
    verifier: {
      strictRevocation: !!opts.strict,
      verify: (token: string, o: any) => {
        calls.verify.push([token, o]);
        if (opts.verifyError) throw opts.verifyError;
        return opts.claims ?? claims();
      },
    },
    registry: {
      exists: async (sid: string) => {
        calls.exists.push(sid);
        if (opts.exists instanceof Error) throw opts.exists;
        return opts.exists ?? true;
      },
    },
    logger: { warn: (m: string) => calls.warn.push(m) },
  };
  return { deps, calls };
}

const req = (over: any = {}) => ({
  path: '/x',
  headers: { Authorization: 'Bearer tok' },
  cookies: {},
  context: { clientId: 'client' },
  ...over,
});

describe('jwtAuthenticate', () => {
  it('extracts bearer header (lowercase too) and passes clientId', async () => {
    const { deps, calls } = setup();
    await jwtAuthenticate(deps, req());
    await jwtAuthenticate(deps, req({ headers: { authorization: 'Bearer t2' } }));
    assert.deepEqual(calls.verify[0], ['tok', { clientId: 'client' }]);
    assert.equal(calls.verify[1][0], 't2');
  });

  it('extracts accessToken cookie', async () => {
    const { deps, calls } = setup();
    await jwtAuthenticate(deps, req({ headers: {}, cookies: { accessToken: 'ck' } }));
    assert.equal(calls.verify[0][0], 'ck');
  });

  it('rejects missing token, malformed and non-Bearer headers', async () => {
    const { deps } = setup();
    await assert.rejects(jwtAuthenticate(deps, req({ headers: {} })), (e: any) => {
      assert.equal(e.code, status.UNAUTHENTICATED);
      assert.match(e.message, /No 'Authorization' header or 'accessToken' cookie/);
      return true;
    });
    await assert.rejects(
      jwtAuthenticate(deps, req({ headers: { Authorization: 'tok' } })),
      /malformed/,
    );
    await assert.rejects(
      jwtAuthenticate(deps, req({ headers: { Authorization: 'Basic tok' } })),
      /Bearer/,
    );
  });

  it('propagates verify failures', async () => {
    const err = Object.assign(new Error('expired'), { code: status.UNAUTHENTICATED });
    const { deps } = setup({ verifyError: err });
    await assert.rejects(jwtAuthenticate(deps, req()), err);
  });

  it('requires 2FA unless on whitelisted paths', async () => {
    const { deps } = setup({ claims: claims({ authorized: false }) });
    await assert.rejects(jwtAuthenticate(deps, req()), (e: any) => {
      assert.equal(e.code, status.UNAUTHENTICATED);
      assert.equal(e.message, '2FA is required');
      return true;
    });
    for (const p of ['verify', 'authorize', 'recover']) {
      await jwtAuthenticate(deps, req({ path: `/authentication/twoFa/${p}` }));
    }
  });

  it('checks the registry only with strict revocation', async () => {
    const off = setup({ exists: false });
    await jwtAuthenticate(off.deps, req());
    assert.equal(off.calls.exists.length, 0);
    const on = setup({ strict: true, exists: false });
    await assert.rejects(jwtAuthenticate(on.deps, req()), (e: any) => {
      assert.equal(e.code, status.UNAUTHENTICATED);
      assert.equal(e.message, 'Session revoked');
      return true;
    });
    assert.deepEqual(on.calls.exists, ['s1']);
    const ok = setup({ strict: true, exists: true });
    await jwtAuthenticate(ok.deps, req());
  });

  it('fails closed on registry errors', async () => {
    const { deps, calls } = setup({ strict: true, exists: new Error('timeout') });
    await assert.rejects(jwtAuthenticate(deps, req()), (e: any) => {
      assert.equal(e.code, status.UNAVAILABLE);
      assert.equal(e.message, 'Session registry unavailable');
      return true;
    });
    assert.equal(calls.warn.length, 1);
  });

  it('returns the context additions without user', async () => {
    const c = claims({ rid: 'r1' });
    const { deps } = setup({ claims: c });
    const res = await jwtAuthenticate(deps, req());
    assert.deepEqual(res, { userId: 'u1', jwtPayload: c, realm: 'r1', sessionId: 's1' });
    assert.ok(!('user' in res));
    const { deps: d2 } = setup();
    assert.equal((await jwtAuthenticate(d2, req())).realm, null);
  });
});

describe('jwtAuthenticate extras', () => {
  it('header takes precedence over cookie', async () => {
    const { deps, calls } = setup();
    await jwtAuthenticate(deps, req({ cookies: { accessToken: 'ck' } }));
    assert.equal(calls.verify[0][0], 'tok');
  });
  it('requires a client id', async () => {
    const { deps, calls } = setup();
    for (const context of [undefined, {}, { clientId: 5 }]) {
      await assert.rejects(jwtAuthenticate(deps, req({ context })), (e: any) => {
        assert.equal(e.code, status.UNAUTHENTICATED);
        assert.equal(e.message, 'Client id missing');
        return true;
      });
    }
    assert.equal(calls.verify.length, 0);
  });
  it('non-string rid yields null realm', async () => {
    const { deps } = setup({ claims: claims({ rid: 5 }) });
    assert.equal((await jwtAuthenticate(deps, req())).realm, null);
  });
});

describe('throttledLogger', () => {
  it('warns at most once per 30s', () => {
    const msgs: string[] = [];
    let t = 0;
    const l = throttledLogger({ warn: m => msgs.push(m) }, () => t)!;
    l.warn('a');
    t = 29_000;
    l.warn('b');
    t = 30_000;
    l.warn('c');
    assert.deepEqual(msgs, ['a', 'c']);
  });
});

describe('createAuthModeToggle', () => {
  it('registers on jwt, unregisters on session, no duplicates', () => {
    const log: string[] = [];
    const infos: string[] = [];
    const apply = createAuthModeToggle(
      {
        registerLocalMiddleware: (n: string) => log.push(`reg:${n}`),
        unregisterLocalMiddleware: (n: string) => log.push(`unreg:${n}`),
      },
      async () => ({}),
      { info: m => infos.push(m) },
    );
    apply({ mode: 'session' });
    apply({ mode: 'jwt' });
    apply({ mode: 'jwt' });
    apply({ mode: 'session' });
    apply({ mode: 'session' });
    assert.deepEqual(log, ['reg:authMiddleware', 'unreg:authMiddleware']);
    assert.equal(infos.length, 2);
  });
});

describe('createSocketRecoveryCheck', () => {
  const mk = (exists: boolean | Error) => {
    const warns: string[] = [];
    const check = createSocketRecoveryCheck(
      {
        exists: async () => {
          if (exists instanceof Error) throw exists;
          return exists;
        },
      },
      { warn: m => warns.push(m) },
    );
    return { check, warns };
  };
  it('uses the registry when sessionId is present', async () => {
    assert.equal(await mk(true).check({ sessionId: 's' }), true);
    assert.equal(await mk(false).check({ sessionId: 's', user: {} }), false);
  });
  it('fails closed on registry error', async () => {
    const { check, warns } = mk(new Error('boom'));
    assert.equal(await check({ sessionId: 's' }), false);
    assert.equal(warns.length, 1);
  });
  it('allows anonymous contexts without sessionId', async () => {
    assert.equal(await mk(false).check({}), true);
    assert.equal(await mk(false).check({ clientId: 'c' }), true);
  });
});
