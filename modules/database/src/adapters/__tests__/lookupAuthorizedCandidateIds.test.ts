import { describe, expect, it, jest } from '@jest/globals';
import { SchemaAdapter } from '../SchemaAdapter.js';

function authorizedAdapter(options?: {
  authzEnabled?: boolean;
  permissionCheck?: (
    operation: string,
    userId?: string,
    scope?: string,
  ) => Promise<
    { findMany: (query: unknown, opts: unknown) => Promise<unknown> } | undefined
  >;
}) {
  const permissionCheck = jest.fn(options?.permissionCheck ?? (async () => undefined));
  const adapter = Object.create(SchemaAdapter.prototype) as SchemaAdapter<unknown>;
  Object.assign(adapter, {
    originalSchema: {
      name: 'Article',
      modelOptions: {
        conduit: { authorization: { enabled: options?.authzEnabled ?? true } },
      },
    },
    adapter: { getDatabaseType: () => 'MongoDB' },
    permissionCheck,
  });
  return { adapter, permissionCheck };
}

describe('lookupAuthorizedCandidateIds', () => {
  it('returns no ids when authorization is on and the read view is missing', async () => {
    const { adapter, permissionCheck } = authorizedAdapter({
      permissionCheck: async () => undefined,
    });
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a', 'b'], 'user-1'),
    ).resolves.toEqual([]);
    expect(permissionCheck).toHaveBeenCalledWith('read', 'user-1', undefined);
  });

  it('returns no ids when authorization is on and no subject was passed', async () => {
    const { adapter, permissionCheck } = authorizedAdapter();
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a', 'b']),
    ).resolves.toEqual([]);
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a'], ''),
    ).resolves.toEqual([]);
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a'], undefined, ''),
    ).resolves.toEqual([]);
    expect(permissionCheck).not.toHaveBeenCalled();
  });

  it('uses the scope read view when userId is empty', async () => {
    const findMany = jest.fn(async () => [{ _id: 'a' }]);
    const { adapter, permissionCheck } = authorizedAdapter({
      permissionCheck: async () => ({ findMany }),
    });
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a', 'b'], '', 'Team:org'),
    ).resolves.toEqual(['a']);
    expect(permissionCheck).toHaveBeenCalledWith('read', '', 'Team:org');
  });

  it('returns only the ids the read view contains', async () => {
    const findMany = jest.fn(async () => [{ _id: 'a' }, { _id: 'c' }]);
    const { adapter } = authorizedAdapter({
      permissionCheck: async () => ({ findMany }),
    });
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a', 'b', 'c'], 'user-1', 'Team:org'),
    ).resolves.toEqual(['a', 'c']);
    expect(findMany).toHaveBeenCalledWith(
      { _id: { $in: ['a', 'b', 'c'] } },
      { select: '_id', userId: undefined, scope: undefined },
    );
  });

  it('returns no ids when the read view query is empty', async () => {
    const { adapter } = authorizedAdapter({
      permissionCheck: async () => ({ findMany: async () => [] }),
    });
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a'], 'user-1'),
    ).resolves.toEqual([]);
  });

  it('propagates view query errors', async () => {
    const { adapter } = authorizedAdapter({
      permissionCheck: async () => ({
        findMany: async () => {
          throw new Error('connection reset');
        },
      }),
    });
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a'], 'user-1'),
    ).rejects.toThrow('connection reset');
  });

  it('propagates permissionCheck errors', async () => {
    const { adapter } = authorizedAdapter({
      permissionCheck: async () => {
        throw new Error('User:user-1 is not allowed to read Team:org');
      },
    });
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a'], 'user-1', 'Team:org'),
    ).rejects.toThrow('User:user-1 is not allowed to read Team:org');
  });

  it('returns the candidate ids when authorization is disabled', async () => {
    const { adapter, permissionCheck } = authorizedAdapter({ authzEnabled: false });
    await expect(
      adapter.lookupAuthorizedCandidateIds('read', ['a', 'b']),
    ).resolves.toEqual(['a', 'b']);
    expect(permissionCheck).not.toHaveBeenCalled();
  });
});
