import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  createSocketGate,
  guardRecoveredSocket,
  runWhenAllowed,
} from './recoveryCheck.js';

function fakeSocket() {
  const emitted: Array<{ event: string; payload: any }> = [];
  const disconnects: boolean[] = [];
  return {
    emitted,
    disconnects,
    socket: {
      data: { accessToken: 'abc' },
      recovered: true,
      connected: true,
      emit: (event: string, payload: unknown) => {
        emitted.push({ event, payload });
        return true;
      },
      disconnect: (close?: boolean) => {
        disconnects.push(close === true);
      },
    } as any,
  };
}

describe('guardRecoveredSocket', () => {
  it('allows when no check is set', async () => {
    const f = fakeSocket();
    assert.equal(await guardRecoveredSocket(f.socket), true);
    assert.equal(f.emitted.length, 0);
    assert.equal(f.disconnects.length, 0);
  });

  it('allows when the check resolves true, passing socket.data', async () => {
    const f = fakeSocket();
    let seen: unknown;
    const ok = await guardRecoveredSocket(f.socket, async ctx => {
      seen = ctx;
      return true;
    });
    assert.equal(ok, true);
    assert.deepEqual(seen, { accessToken: 'abc' });
    assert.equal(f.disconnects.length, 0);
  });

  it('emits conduit_error and disconnects when the check resolves false', async () => {
    const f = fakeSocket();
    const warn = mock.method(ConduitGrpcSdk.Logger, 'warn', () => {});
    assert.equal(await guardRecoveredSocket(f.socket, async () => false), false);
    assert.equal(f.emitted.length, 1);
    assert.equal(f.emitted[0].event, 'conduit_error');
    assert.equal(f.emitted[0].payload.name, 'UNAUTHENTICATED');
    assert.equal(f.emitted[0].payload.status, 401);
    assert.deepEqual(f.disconnects, [true]);
    assert.equal(warn.mock.callCount(), 1);
    warn.mock.restore();
  });

  it('emits conduit_error and disconnects when the check throws', async () => {
    const f = fakeSocket();
    const ok = await guardRecoveredSocket(f.socket, async () => {
      throw new Error('boom');
    });
    assert.equal(ok, false);
    assert.equal(f.emitted[0].event, 'conduit_error');
    assert.deepEqual(f.disconnects, [true]);
  });
});

describe('socket gate (recovered socket events)', () => {
  function deferred() {
    let resolve!: (v: boolean) => void;
    const promise = new Promise<boolean>(r => (resolve = r));
    return { promise, resolve };
  }

  it('does not run events emitted before a failing check resolves', async () => {
    const f = fakeSocket();
    const d = deferred();
    const gate = createSocketGate(f.socket, () => d.promise);
    const ran: string[] = [];
    const p = [
      runWhenAllowed(gate, f.socket, () => ran.push('recovered')),
      runWhenAllowed(gate, f.socket, () => ran.push('e1')),
    ];
    assert.deepEqual(ran, []);
    d.resolve(false);
    await Promise.all(p);
    assert.deepEqual(ran, []);
    assert.deepEqual(f.disconnects, [true]);
  });

  it('runs buffered events in order once the check passes', async () => {
    const f = fakeSocket();
    const d = deferred();
    const gate = createSocketGate(f.socket, () => d.promise);
    const ran: string[] = [];
    const p = ['recovered', 'e1', 'e2'].map(n =>
      runWhenAllowed(gate, f.socket, () => ran.push(n)),
    );
    assert.deepEqual(ran, []);
    d.resolve(true);
    await Promise.all(p);
    assert.deepEqual(ran, ['recovered', 'e1', 'e2']);
  });

  it('skips work when the socket is no longer connected', async () => {
    const f = fakeSocket();
    const gate = createSocketGate(f.socket, async () => true);
    f.socket.connected = false;
    const ran: string[] = [];
    await runWhenAllowed(gate, f.socket, () => ran.push('x'));
    assert.deepEqual(ran, []);
  });

  it('non-recovered sockets pass immediately without calling the check', async () => {
    const f = fakeSocket();
    f.socket.recovered = false;
    let called = false;
    const gate = createSocketGate(f.socket, async () => {
      called = true;
      return false;
    });
    assert.equal(await gate, true);
    assert.equal(called, false);
  });

  it('never rejects when the handler throws', async () => {
    const f = fakeSocket();
    const err = mock.method(ConduitGrpcSdk.Logger, 'error', () => {});
    const gate = createSocketGate(f.socket, async () => true);
    await runWhenAllowed(gate, f.socket, () => {
      throw new Error('x');
    });
    assert.equal(err.mock.callCount(), 1);
    err.mock.restore();
  });
});
