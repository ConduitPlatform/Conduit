import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { ManagedModule } from '@conduitplatform/module-tools';
import Storage from './Storage.js';

type Reply = { error: { code: number; message: string } | null; response?: unknown };

afterEach(() => {
  mock.restoreAll();
});

/** Calls Storage.setConfig with the base implementation replaced by a stub. */
async function setConfig(newConfig: string) {
  const base = mock.method(
    ManagedModule.prototype,
    'setConfig',
    async (_call: unknown, callback: (err: null, res: unknown) => void) =>
      callback(null, { updatedConfig: '{}' }),
  );
  const reply = await new Promise<Reply>(resolve => {
    void Storage.prototype.setConfig.call(
      {} as Storage,
      { request: { newConfig } } as never,
      ((error: Reply['error'], response?: unknown) =>
        resolve({ error, response })) as never,
    );
  });
  return { reply, base };
}

describe('Storage.setConfig rate limit validation', () => {
  for (const write of [{ maxRequests: 0 }, { resetInterval: 86_401 }]) {
    it(`rejects ${JSON.stringify(write)} before the base implementation`, async () => {
      const { reply, base } = await setConfig(JSON.stringify({ rateLimits: { write } }));
      assert.equal(base.mock.callCount(), 0);
      assert.equal(reply.error?.code, status.INVALID_ARGUMENT);
      const body = JSON.parse(reply.error!.message);
      assert.equal(body.conduitCode, 'STORAGE_CONFIG_INVALID');
      assert.match(body.message, /^rateLimits\.write\./);
    });
  }

  it('passes a valid update to the base implementation unchanged', async () => {
    const newConfig = JSON.stringify({
      rateLimits: { write: { maxRequests: 500, resetInterval: 3600 } },
    });
    const { reply, base } = await setConfig(newConfig);
    assert.equal(reply.error, null);
    assert.equal(base.mock.callCount(), 1);
    const [call] = base.mock.calls[0].arguments as unknown as [
      { request: { newConfig: string } },
    ];
    assert.equal(call.request.newConfig, newConfig);
  });

  it('leaves malformed JSON to the base implementation', async () => {
    const { reply, base } = await setConfig('{not json');
    assert.equal(reply.error, null);
    assert.equal(base.mock.callCount(), 1);
  });
});
