import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { Relationship } from '../../models/index.js';
import { IndexController } from '../index.controller.js';
import { RelationsController } from '../relations.controller.js';
import { ResourceController } from '../resource.controller.js';

function resetSingleton(target: { _instance?: unknown }) {
  target._instance = undefined;
}

describe('findRelations', () => {
  const findMany =
    jest.fn<
      (
        query: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => Promise<unknown[]>
    >();
  const countDocuments = jest.fn<(query: Record<string, unknown>) => Promise<number>>();
  let relations: RelationsController;

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue([]);
    countDocuments.mockReset().mockResolvedValue(0);
    resetSingleton(ResourceController as unknown as { _instance?: unknown });
    resetSingleton(IndexController as unknown as { _instance?: unknown });
    resetSingleton(RelationsController as unknown as { _instance?: unknown });
    jest.spyOn(Relationship, 'getInstance').mockReturnValue({
      findMany,
      countDocuments,
    } as unknown as Relationship);
    relations = RelationsController.getInstance({} as ConduitGrpcSdk);
  });

  it('pages in a stable order', async () => {
    await relations.findRelations({ subject: 'User:1', resourceType: 'Team' }, 500, 500);
    expect(findMany).toHaveBeenCalledWith(
      { subject: 'User:1', resourceType: 'Team' },
      { skip: 500, limit: 500, sort: { _id: 1 } },
    );
  });
});
