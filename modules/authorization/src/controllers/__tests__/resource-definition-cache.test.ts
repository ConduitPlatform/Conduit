import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  ActorIndex,
  ObjectIndex,
  Relationship,
  ResourceDefinition,
} from '../../models/index.js';
import { IndexController } from '../index.controller.js';
import { RelationsController } from '../relations.controller.js';
import { ResourceController } from '../resource.controller.js';

function resetSingleton(target: { _instance?: unknown }) {
  target._instance = undefined;
}

describe('resource definition cache invalidation', () => {
  const events: string[] = [];
  const grpcSdk = {
    state: {
      setKey: jest.fn(async (key: string) => {
        if (key === 'ruleCache:globalVer') events.push('invalidate');
      }),
    },
    bus: { publish: jest.fn() },
  } as unknown as ConduitGrpcSdk;
  const definitionFindOne =
    jest.fn<(query: Record<string, unknown>) => Promise<unknown>>();
  const definitionCreate =
    jest.fn<(document: Record<string, unknown>) => Promise<unknown>>();
  const definitionUpdate =
    jest.fn<(id: string, document: Record<string, unknown>) => Promise<unknown>>();
  const definitionDelete =
    jest.fn<(query: Record<string, unknown>) => Promise<unknown>>();
  let resources: ResourceController;

  beforeEach(() => {
    events.length = 0;
    definitionFindOne.mockReset();
    definitionCreate.mockReset();
    definitionUpdate.mockReset();
    definitionDelete.mockReset();
    definitionCreate.mockImplementation(async () => {
      events.push('create');
      return { _id: 'def-1', name: 'Team', version: 0 };
    });
    definitionUpdate.mockImplementation(async () => {
      events.push('update');
      return { _id: 'def-1', name: 'Team', version: 2 };
    });
    definitionDelete.mockImplementation(async () => {
      events.push('delete');
      return { deletedCount: 1 };
    });

    resetSingleton(ResourceController as unknown as { _instance?: unknown });
    resetSingleton(IndexController as unknown as { _instance?: unknown });
    resetSingleton(RelationsController as unknown as { _instance?: unknown });
    jest.spyOn(ResourceDefinition, 'getInstance').mockReturnValue({
      findOne: definitionFindOne,
      create: definitionCreate,
      findByIdAndUpdate: definitionUpdate,
      deleteOne: definitionDelete,
      countDocuments: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
    } as unknown as ResourceDefinition);
    jest.spyOn(ActorIndex, 'getInstance').mockReturnValue({
      deleteMany: jest.fn(async () => undefined),
    } as unknown as ActorIndex);
    jest.spyOn(ObjectIndex, 'getInstance').mockReturnValue({
      deleteMany: jest.fn(async () => undefined),
    } as unknown as ObjectIndex);
    jest.spyOn(Relationship, 'getInstance').mockReturnValue({
      deleteMany: jest.fn(async () => undefined),
      findMany: jest.fn(async () => []),
    } as unknown as Relationship);
    resources = ResourceController.getInstance(grpcSdk);
  });

  it('invalidates after a resource definition is created', async () => {
    definitionFindOne.mockResolvedValue(null);

    await resources.createResource({
      name: 'Team',
      version: 0,
      permissions: { read: ['member'] },
      relations: {},
    });

    expect(events).toEqual(['create', 'invalidate']);
  });

  it('invalidates after a resource definition is updated', async () => {
    definitionFindOne.mockResolvedValue({
      _id: 'def-1',
      name: 'Team',
      version: 1,
      permissions: { read: ['member'] },
      relations: {},
    });

    await resources.updateResourceDefinition(
      { name: 'Team' },
      {
        name: 'Team',
        version: 2,
        permissions: { read: ['member'] },
        relations: {},
      },
    );

    expect(events).toEqual(['update', 'invalidate']);
  });

  it('invalidates after a resource definition is deleted', async () => {
    definitionFindOne.mockResolvedValue({ _id: 'def-1', name: 'Team' });

    await resources.deleteResource('Team');

    expect(events).toEqual(['delete', 'invalidate']);
  });

  it('does not invalidate while rebuilding or removing resource indexes', async () => {
    await IndexController.getInstance().reIndexResource('Team');
    await RelationsController.getInstance().removeResource('Team');

    expect(events).toEqual([]);
  });
});
