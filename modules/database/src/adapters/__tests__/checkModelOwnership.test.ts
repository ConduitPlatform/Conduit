import { describe, expect, it } from '@jest/globals';
import { ConduitSchema } from '@conduitplatform/grpc-sdk';
import { DatabaseAdapter } from '../DatabaseAdapter.js';

function adapterWithDeclared(declared: Record<string, unknown> | null) {
  const adapter = Object.create(DatabaseAdapter.prototype) as DatabaseAdapter<never>;
  Object.assign(adapter, {
    models: {
      _DeclaredSchema: { findOne: async () => declared },
    },
  });
  return adapter;
}

function schema(name: string, ownerModule: string) {
  const s = new ConduitSchema(name, {}, {});
  s.ownerModule = ownerModule;
  return s;
}

describe('checkModelOwnership', () => {
  it('allows a new schema', async () => {
    const adapter = adapterWithDeclared(null);
    await expect(
      adapter.checkModelOwnership(schema('Foo', 'communications')),
    ).resolves.toBe(true);
  });

  it('allows the owning module', async () => {
    const adapter = adapterWithDeclared({ name: 'Foo', ownerModule: 'chat' });
    await expect(adapter.checkModelOwnership(schema('Foo', 'chat'))).resolves.toBe(true);
  });

  it('rejects a different module', async () => {
    const adapter = adapterWithDeclared({ name: 'Foo', ownerModule: 'chat' });
    await expect(
      adapter.checkModelOwnership(schema('Foo', 'communications')),
    ).resolves.toBe(false);
  });

  it.each(['email', 'sms', 'pushNotifications'])(
    'lets communications take over schemas owned by legacy %s module',
    async legacyOwner => {
      const adapter = adapterWithDeclared({
        name: 'EmailTemplate',
        ownerModule: legacyOwner,
      });
      await expect(
        adapter.checkModelOwnership(schema('EmailTemplate', 'communications')),
      ).resolves.toBe(true);
    },
  );

  it('does not let other modules take over legacy communication schemas', async () => {
    const adapter = adapterWithDeclared({ name: 'EmailTemplate', ownerModule: 'email' });
    await expect(
      adapter.checkModelOwnership(schema('EmailTemplate', 'authentication')),
    ).resolves.toBe(false);
  });
});
