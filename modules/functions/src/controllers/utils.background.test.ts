import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { FunctionExecutions } from '../models/index.js';
import type { Functions } from '../models/index.js';
import { compileFunctionCode, executeBackgroundFunction } from './utils.js';

const originalGetInstance = FunctionExecutions.getInstance;

function mockFunctionExecutions() {
  const created: Array<{ success: boolean }> = [];
  FunctionExecutions.getInstance = (() => ({
    create: async (doc: { success: boolean }) => {
      created.push(doc);
      return doc;
    },
  })) as unknown as typeof FunctionExecutions.getInstance;
  return created;
}

function cronLikeFunction(overrides: Partial<Functions> = {}): Functions {
  return {
    _id: 'fn1',
    name: 'bg-fn',
    functionType: 'cron',
    functionCode: "res('ok');",
    timeout: 5_000,
    returns: 'String',
    inputs: { cronPattern: '*/5 * * * *' },
    ...overrides,
  } as Functions;
}

describe('executeBackgroundFunction failure path', () => {
  afterEach(() => {
    FunctionExecutions.getInstance = originalGetInstance;
  });

  it('rethrows when the user function throws', async () => {
    mockFunctionExecutions();
    const func = cronLikeFunction({
      functionCode: "throw new Error('intentional failure');",
    });
    const compiled = compileFunctionCode(func.functionCode);

    await assert.rejects(
      () =>
        executeBackgroundFunction(
          func,
          { trigger: 'cron' },
          compiled,
          {} as ConduitGrpcSdk,
        ),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Execution failed|intentional failure/);
        return true;
      },
    );
  });

  it('does not invoke a success callback when execution fails', async () => {
    mockFunctionExecutions();
    const func = cronLikeFunction({
      functionCode: "throw new Error('intentional failure');",
    });
    const compiled = compileFunctionCode(func.functionCode);

    let successLogged = false;
    await executeBackgroundFunction(
      func,
      { trigger: 'event' },
      compiled,
      {} as ConduitGrpcSdk,
    ).then(
      () => {
        successLogged = true;
      },
      () => undefined,
    );

    assert.equal(successLogged, false);
  });

  it('resolves on success so callers can log completion', async () => {
    mockFunctionExecutions();
    const func = cronLikeFunction();
    const compiled = compileFunctionCode(func.functionCode);

    await executeBackgroundFunction(
      func,
      { trigger: 'cron' },
      compiled,
      {} as ConduitGrpcSdk,
    );
  });
});
