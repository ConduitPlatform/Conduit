import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { Permission, ResourceDefinition } from '../../models/index.js';
import { IndexController } from '../index.controller.js';
import { PermissionsController } from '../permissions.controller.js';
import { RuleCache } from '../cache.controller.js';
import { checkPermissionTuple, checkRelation } from '../../utils/index.js';

const TEAM_PERMISSIONS = {
  overview_edit: ['management'],
  overview_read: ['management', 'operations'],
  trips_read: ['management'],
  read: ['member'],
};

function createState() {
  const values = new Map<string, string>();
  return {
    values,
    getKey: jest.fn(async (key: string) => values.get(key) ?? null),
    setKey: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function resetSingleton(target: { _instance?: unknown }) {
  target._instance = undefined;
}

describe('subject permission inventory', () => {
  const state = createState();
  const grpcSdk = { state } as unknown as ConduitGrpcSdk;
  const permissionFindMany =
    jest.fn<
      (
        query: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => Promise<Array<{ permission: string }>>
    >();
  const permissionCreate =
    jest.fn<(document: Record<string, unknown>) => Promise<{ _id: string }>>();
  const permissionFindOne =
    jest.fn<(query: Record<string, unknown>) => Promise<{ _id: string } | null>>();
  const permissionDeleteOne =
    jest.fn<(query: Record<string, unknown>) => Promise<void>>();
  const definitionFindOne = jest.fn<
    (query: Record<string, unknown>) => Promise<{
      name: string;
      permissions: Record<string, string[]>;
    } | null>
  >();
  let inheritedActions: ReturnType<typeof jest.spyOn>;
  let controller: PermissionsController;

  beforeEach(() => {
    state.values.clear();
    permissionFindMany.mockReset();
    permissionFindMany.mockResolvedValue([]);
    permissionCreate.mockReset();
    permissionFindOne.mockReset();
    permissionFindOne.mockResolvedValue(null);
    permissionDeleteOne.mockReset();
    definitionFindOne.mockReset();
    definitionFindOne.mockResolvedValue({
      name: 'Team',
      permissions: { ...TEAM_PERMISSIONS },
    });

    resetSingleton(PermissionsController as unknown as { _instance?: unknown });
    resetSingleton(IndexController as unknown as { _instance?: unknown });
    jest.spyOn(Permission, 'getInstance').mockReturnValue({
      findMany: permissionFindMany,
      create: permissionCreate,
      findOne: permissionFindOne,
      deleteOne: permissionDeleteOne,
    } as unknown as Permission);
    jest.spyOn(ResourceDefinition, 'getInstance').mockReturnValue({
      findOne: definitionFindOne,
    } as unknown as ResourceDefinition);

    const index = IndexController.getInstance(grpcSdk);
    inheritedActions = jest
      .spyOn(index, 'findInheritedActions')
      .mockResolvedValue(new Set());
    controller = PermissionsController.getInstance(grpcSdk);
  });

  it('returns every declared action in stable order from one direct and one inherited lookup', async () => {
    const result = await controller.getSubjectPermissions('User:1', 'Team:admin');

    expect(result.map(entry => entry.action)).toEqual([
      'overview_edit',
      'overview_read',
      'read',
      'trips_read',
    ]);
    expect(result.every(entry => entry.allowed === false)).toBe(true);
    expect(permissionFindMany).toHaveBeenCalledTimes(1);
    expect(permissionFindMany).toHaveBeenCalledWith(
      {
        subject: 'User:1',
        resource: 'Team:admin',
        permission: {
          $in: ['overview_edit', 'overview_read', 'read', 'trips_read'],
        },
      },
      { select: 'permission' },
    );
    expect(inheritedActions).toHaveBeenCalledTimes(1);
    expect(inheritedActions).toHaveBeenCalledWith('User:1', 'Team:admin', [
      'overview_edit',
      'overview_read',
      'read',
      'trips_read',
    ]);
  });

  it('filters actions by a literal prefix', async () => {
    const result = await controller.getSubjectPermissions(
      'User:1',
      'Team:admin',
      'overview_',
    );

    expect(result.map(entry => entry.action)).toEqual(['overview_edit', 'overview_read']);
    expect(permissionFindMany.mock.calls[0]?.[0]).toMatchObject({
      permission: { $in: ['overview_edit', 'overview_read'] },
    });
  });

  it('keeps direct and inherited provenance when both apply', async () => {
    permissionFindMany.mockResolvedValue([{ permission: 'overview_edit' }]);
    inheritedActions.mockResolvedValue(new Set(['overview_edit', 'overview_read']));

    const result = await controller.getSubjectPermissions(
      'User:1',
      'Team:admin',
      'overview_',
    );

    expect(result).toEqual([
      {
        action: 'overview_edit',
        direct: true,
        inherited: true,
        implicit: false,
        allowed: true,
      },
      {
        action: 'overview_read',
        direct: false,
        inherited: true,
        implicit: false,
        allowed: true,
      },
    ]);
  });

  it('marks a self-resource as implicit while still checking direct and inherited access', async () => {
    const result = await controller.getSubjectPermissions(
      'Team:admin',
      'Team:admin',
      'read',
    );

    expect(result).toEqual([
      {
        action: 'read',
        direct: false,
        inherited: false,
        implicit: true,
        allowed: true,
      },
    ]);
    expect(permissionFindMany).toHaveBeenCalledTimes(1);
    expect(inheritedActions).toHaveBeenCalledTimes(1);
  });

  it('does not query permissions when the prefix matches nothing', async () => {
    await expect(
      controller.getSubjectPermissions('User:1', 'Team:admin', 'missing'),
    ).resolves.toEqual([]);

    expect(permissionFindMany).not.toHaveBeenCalled();
    expect(inheritedActions).not.toHaveBeenCalled();
  });

  it('serves a repeated inventory from cache until the subject or global version changes', async () => {
    await controller.getSubjectPermissions('User:1', 'Team:admin');
    await controller.getSubjectPermissions('User:1', 'Team:admin');
    expect(permissionFindMany).toHaveBeenCalledTimes(1);
    expect(definitionFindOne).toHaveBeenCalledTimes(1);

    await RuleCache.invalidateSubject(grpcSdk, 'User:1');
    await controller.getSubjectPermissions('User:1', 'Team:admin');
    expect(permissionFindMany).toHaveBeenCalledTimes(2);

    await RuleCache.invalidateGlobal(grpcSdk);
    await controller.getSubjectPermissions('User:1', 'Team:admin');
    expect(permissionFindMany).toHaveBeenCalledTimes(3);
  });

  it('ignores a corrupt cache entry and loads the inventory again', async () => {
    await RuleCache.storeInventory(grpcSdk, 'User:1', 'Team:admin', '', [
      {
        action: 'read',
        direct: true,
        inherited: false,
        implicit: false,
        allowed: true,
      },
    ]);
    for (const key of state.values.keys()) {
      if (key.includes(':inventory:')) state.values.set(key, '{');
    }

    const result = await controller.getSubjectPermissions('User:1', 'Team:admin');

    expect(permissionFindMany).toHaveBeenCalledTimes(1);
    expect(result.map(entry => entry.action)).toEqual([
      'overview_edit',
      'overview_read',
      'read',
      'trips_read',
    ]);
  });

  it('returns NOT_FOUND when the resource definition does not exist', async () => {
    definitionFindOne.mockResolvedValue(null);

    await expect(
      controller.getSubjectPermissions('User:1', 'Team:admin'),
    ).rejects.toMatchObject({
      code: status.NOT_FOUND,
      message: 'Resource definition not found',
    });
    await expect(
      controller.getSubjectPermissions('User:1', 'Team:admin'),
    ).rejects.toBeInstanceOf(GrpcError);
  });

  it('returns INVALID_ARGUMENT for a malformed subject, resource, or prefix', async () => {
    await expect(
      controller.getSubjectPermissions('user', 'Team:admin'),
    ).rejects.toMatchObject({
      code: status.INVALID_ARGUMENT,
    });
    await expect(
      controller.getSubjectPermissions('User:1', 'Team:'),
    ).rejects.toMatchObject({
      code: status.INVALID_ARGUMENT,
    });
    await expect(
      controller.getSubjectPermissions('User:1', 'Team:admin', 'overview-'),
    ).rejects.toMatchObject({
      code: status.INVALID_ARGUMENT,
    });
    expect(definitionFindOne).not.toHaveBeenCalled();
  });
});

describe('permission action names', () => {
  const state = createState();
  const grpcSdk = { state } as unknown as ConduitGrpcSdk;
  const permissionCreate =
    jest.fn<(document: Record<string, unknown>) => Promise<{ _id: string }>>();
  const permissionFindOne =
    jest.fn<(query: Record<string, unknown>) => Promise<{ _id: string } | null>>();
  const permissionDeleteOne =
    jest.fn<(query: Record<string, unknown>) => Promise<void>>();
  let controller: PermissionsController;

  beforeEach(() => {
    state.values.clear();
    permissionCreate.mockReset();
    permissionFindOne.mockReset();
    permissionDeleteOne.mockReset();
    resetSingleton(PermissionsController as unknown as { _instance?: unknown });
    resetSingleton(IndexController as unknown as { _instance?: unknown });
    jest.spyOn(Permission, 'getInstance').mockReturnValue({
      create: permissionCreate,
      findOne: permissionFindOne,
      deleteOne: permissionDeleteOne,
      findMany: jest.fn<(query: Record<string, unknown>) => Promise<unknown[]>>(),
    } as unknown as Permission);
    controller = PermissionsController.getInstance(grpcSdk);
  });

  it('accepts snake_case permission actions and rejects other characters', async () => {
    expect(() =>
      checkPermissionTuple('User:1', 'overview_read', 'Team:admin'),
    ).not.toThrow();
    expect(() => checkRelation('User:1', 'overview_read', 'Team:2')).toThrow(
      'Relation must be a plain string',
    );

    await controller.grantPermission('User:1', 'overview_read', 'Team:admin');
    expect(permissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: 'overview_read',
        computedTuple: 'User:1#overview_read@Team:admin',
      }),
    );

    await expect(
      controller.grantPermission('User:1', 'overview-read', 'Team:admin'),
    ).rejects.toThrow(
      'Action must start with a letter and contain only letters, numbers, and underscores',
    );
    expect(permissionCreate).toHaveBeenCalledTimes(1);

    permissionFindOne.mockResolvedValue({ _id: 'perm-1' });
    await controller.removePermission('User:1', 'overview_read', 'Team:admin');
    expect(permissionDeleteOne).toHaveBeenCalledWith({ _id: 'perm-1' });

    permissionFindOne.mockResolvedValue({ _id: 'perm-2' });
    await expect(controller.can('User:1', 'overview_read', 'Team:admin')).resolves.toBe(
      true,
    );
  });
});
