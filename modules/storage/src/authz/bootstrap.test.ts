import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigController } from '@conduitplatform/module-tools';
import { _StorageContainer } from '../models/index.js';
import { ensureDefaultContainer } from './bootstrap.js';

const originalConfig = ConfigController.getInstance().config;
const originalGetInstance = _StorageContainer.getInstance.bind(_StorageContainer);

afterEach(() => {
  ConfigController.getInstance().config = originalConfig;
  _StorageContainer.getInstance = originalGetInstance;
});

describe('ensureDefaultContainer', () => {
  it('creates a missing default container in DB and on the provider without owning it', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
    };
    let created: { name: string; isPublic?: boolean } | undefined;
    _StorageContainer.getInstance = (() => ({
      findOne: async () => null,
      create: async (doc: { name: string; isPublic?: boolean }) => {
        created = doc;
        return { _id: 'c1', ...doc };
      },
    })) as unknown as typeof _StorageContainer.getInstance;

    const providerCalls: string[] = [];
    const container = await ensureDefaultContainer({
      containerExists: async (name: string) => {
        providerCalls.push(`exists:${name}`);
        return false;
      },
      createContainer: async (name: string) => {
        providerCalls.push(`create:${name}`);
        return true;
      },
    } as never);

    assert.equal(container.name, 'conduit');
    assert.equal(created?.isPublic, false);
    assert.deepEqual(providerCalls, ['exists:conduit', 'create:conduit']);
  });

  it('is idempotent when the default container already exists on DB and provider', async () => {
    ConfigController.getInstance().config = {
      defaultContainer: 'conduit',
    };
    let createDb = 0;
    _StorageContainer.getInstance = (() => ({
      findOne: async () => ({ _id: 'c1', name: 'conduit' }),
      create: async () => {
        createDb += 1;
        return { _id: 'c1', name: 'conduit' };
      },
    })) as unknown as typeof _StorageContainer.getInstance;

    let createProvider = 0;
    await ensureDefaultContainer({
      containerExists: async () => true,
      createContainer: async () => {
        createProvider += 1;
        return true;
      },
    } as never);
    assert.equal(createDb, 0);
    assert.equal(createProvider, 0);
  });
});
