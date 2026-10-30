import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ActorIndex, ObjectIndex } from '../../models/index.js';
import { IndexController } from '../index.controller.js';

function resetSingleton(target: { _instance?: unknown }) {
  target._instance = undefined;
}

describe('findInheritedActions', () => {
  const grpcSdk = {} as ConduitGrpcSdk;
  const objectFindMany =
    jest.fn<
      (
        query: Record<string, unknown>,
      ) => Promise<Array<{ subject: string; entity: string }>>
    >();
  const actorFindMany =
    jest.fn<
      (query: {
        subject: string;
        entity: { $in: string[] };
      }) => Promise<Array<{ entity: string }>>
    >();
  let index: IndexController;

  beforeEach(() => {
    objectFindMany.mockReset();
    objectFindMany.mockResolvedValue([]);
    actorFindMany.mockReset();
    actorFindMany.mockResolvedValue([]);
    resetSingleton(IndexController as unknown as { _instance?: unknown });
    jest.spyOn(ObjectIndex, 'getInstance').mockReturnValue({
      findMany: objectFindMany,
    } as unknown as ObjectIndex);
    jest.spyOn(ActorIndex, 'getInstance').mockReturnValue({
      findMany: actorFindMany,
    } as unknown as ActorIndex);
    index = IndexController.getInstance(grpcSdk);
  });

  it('resolves wildcard and relation inheritance with one object query and one actor query', async () => {
    objectFindMany.mockResolvedValue([
      { subject: 'Team:admin#overview_read', entity: '*' },
      { subject: 'Team:admin#trips_read', entity: 'Team:admin#operations' },
      { subject: 'Team:admin#overview_edit', entity: 'Team:admin#management' },
    ]);
    actorFindMany.mockResolvedValue([{ entity: 'Team:admin#operations' }]);

    const inherited = await index.findInheritedActions('User:1', 'Team:admin', [
      'overview_edit',
      'overview_read',
      'trips_read',
    ]);

    expect([...inherited].sort()).toEqual(['overview_read', 'trips_read']);
    expect(objectFindMany).toHaveBeenCalledTimes(1);
    expect(objectFindMany.mock.calls[0]?.[0]).toEqual({
      subject: {
        $in: [
          'Team:admin#overview_edit',
          'Team:admin#overview_read',
          'Team:admin#trips_read',
        ],
      },
    });
    expect(actorFindMany).toHaveBeenCalledTimes(1);
    expect(actorFindMany.mock.calls[0]?.[0]).toEqual({
      subject: 'User:1',
      entity: { $in: ['Team:admin#operations', 'Team:admin#management'] },
    });
  });

  it('chunks actor-entity lookups instead of querying once per action', async () => {
    const entities = Array.from({ length: 251 }, (_, index) => `Team:admin#role${index}`);
    objectFindMany.mockResolvedValue(
      entities.map(entity => ({ subject: 'Team:admin#overview_read', entity })),
    );

    const inherited = await index.findInheritedActions('User:1', 'Team:admin', [
      'overview_read',
      'overview_edit',
    ]);

    expect(inherited.size).toBe(0);
    expect(objectFindMany).toHaveBeenCalledTimes(1);
    expect(actorFindMany).toHaveBeenCalledTimes(2);
    expect(actorFindMany.mock.calls[0]?.[0].entity.$in).toHaveLength(250);
    expect(actorFindMany.mock.calls[1]?.[0].entity.$in).toHaveLength(1);
  });
});
