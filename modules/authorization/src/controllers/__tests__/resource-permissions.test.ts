import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ResourceDefinition } from '../../models/index.js';
import { IndexController } from '../index.controller.js';
import { RelationsController } from '../relations.controller.js';
import { ResourceController } from '../resource.controller.js';

function resetSingleton(target: { _instance?: unknown }) {
  target._instance = undefined;
}

describe('resource permission names', () => {
  const definitionFindMany =
    jest.fn<(query: Record<string, unknown>) => Promise<unknown[]>>();
  let resources: ResourceController;

  beforeEach(() => {
    definitionFindMany.mockReset();
    resetSingleton(ResourceController as unknown as { _instance?: unknown });
    resetSingleton(IndexController as unknown as { _instance?: unknown });
    resetSingleton(RelationsController as unknown as { _instance?: unknown });
    jest.spyOn(ResourceDefinition, 'getInstance').mockReturnValue({
      findMany: definitionFindMany,
    } as unknown as ResourceDefinition);
    resources = ResourceController.getInstance({} as ConduitGrpcSdk);
  });

  it('rejects an action name that cannot be granted', async () => {
    await expect(
      resources.validateResourcePermissions({
        permissions: { 'overview-read': [] },
        relations: {},
      }),
    ).rejects.toThrow(
      'Action must start with a letter and contain only letters, numbers, and underscores',
    );
    expect(definitionFindMany).not.toHaveBeenCalled();
  });

  it('accepts snake_case actions and relation-scoped permission keys', async () => {
    definitionFindMany.mockResolvedValue([{ name: 'User' }]);

    await expect(
      resources.validateResourcePermissions({
        permissions: {
          overview_read: ['member'],
          'editor->edit': ['User'],
        },
        relations: { editor: ['User'] },
      }),
    ).resolves.toBeUndefined();
  });
});
