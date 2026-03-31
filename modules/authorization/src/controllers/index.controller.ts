import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  ActorIndex,
  ObjectIndex,
  Relationship,
  ResourceDefinition,
} from '../models/index.js';
import { constructObjectIndex } from '../utils/index.js';
import { QueueController } from './queue.controller.js';
import { RuleCache } from './cache.controller.js';

export class IndexController {
  private static _instance: IndexController;
  private static readonly ENTITY_CHUNK_SIZE = 250;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private chunkArray<T>(items: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private uniqueEntities(entities: string[]) {
    return [...new Set(entities.filter(entity => !!entity))];
  }

  private async resolveActorEntities(subject: string) {
    const subjectIndexes = await ActorIndex.getInstance().findMany({
      subject: subject,
    });
    return this.uniqueEntities(subjectIndexes.map(index => index.entity));
  }

  private extractResourceId(subjectPermissionTuple: string) {
    const [resourceTuple] = subjectPermissionTuple.split('#');
    const [, resourceId = ''] = resourceTuple.split(':');
    return resourceId;
  }

  private async findObjectIndexesByEntities(
    baseQuery: Record<string, unknown>,
    entities: string[],
  ) {
    const uniqueEntities = this.uniqueEntities(entities);
    if (!uniqueEntities.length) {
      return [];
    }

    if (uniqueEntities.length <= IndexController.ENTITY_CHUNK_SIZE) {
      return ObjectIndex.getInstance().findMany({
        ...baseQuery,
        entity: { $in: uniqueEntities },
      });
    }

    const chunks = this.chunkArray(uniqueEntities, IndexController.ENTITY_CHUNK_SIZE);
    const merged = [];
    const seen = new Set<string>();
    for (const chunk of chunks) {
      const chunkResults = await ObjectIndex.getInstance().findMany({
        ...baseQuery,
        entity: { $in: chunk },
      });
      for (const result of chunkResults) {
        const key = `${result.subject}|${result.entity}|${(
          result.inheritanceTree ?? []
        ).join(',')}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(result);
      }
    }
    return merged;
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (IndexController._instance) return IndexController._instance;
    if (grpcSdk) {
      return (IndexController._instance = new IndexController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  async reIndexResource(resource: string) {
    ConduitGrpcSdk.Logger.info(
      `Resource ${resource} was modified, scheduling re-indexing`,
    );
    await ActorIndex.getInstance().deleteMany({
      $or: [
        {
          subjectType: resource,
        },
        { entityType: resource },
      ],
    });
    await ObjectIndex.getInstance().deleteMany({
      $or: [
        {
          subjectType: resource,
        },
        { entityType: resource },
      ],
    });
    const relations = await Relationship.getInstance().findMany({
      $or: [
        {
          subjectType: resource,
        },
        { resourceType: resource },
      ],
    });
    if (relations.length > 0) {
      await QueueController.getInstance().addRelationIndexJob(
        relations.map(r => ({
          subject: r.subject,
          relation: r.relation,
          object: r.resource,
        })),
      );
    }
    await RuleCache.invalidateGlobal(this.grpcSdk);
  }

  async createOrUpdateObject(subject: string, entity: string) {
    const index = await ObjectIndex.getInstance().findOne({ subject, entity });
    if (!index) {
      await ObjectIndex.getInstance().create({
        subject,
        subjectType: subject.split(':')[0],
        subjectId: subject.split(':')[1].split('#')[0],
        subjectPermission: subject.split('#')[1],
        entity,
        entityId: entity === '*' ? '*' : entity.split(':')[1].split('#')[0],
        entityType: entity === '*' ? '*' : entity.split(':')[0],
        relation: entity === '*' ? '*' : entity.split('#')[1],
      });
    }
  }

  async constructRelationIndex(subject: string, relation: string, object: string) {
    const objectDefinition = (await ResourceDefinition.getInstance().findOne({
      name: object.split(':')[0],
    }))!;

    // relations can only be created between actors and resources
    // object indexes represent relations between actors and permissions on resources
    // construct actor index
    const found = await ActorIndex.getInstance().findOne({
      subject: subject,
      entity: `${object}#${relation}`,
    });
    if (!found) {
      await ActorIndex.getInstance().create({
        subject: subject,
        subjectId: subject.split(':')[1],
        subjectType: subject.split(':')[0],
        entity: `${object}#${relation}`,
        entityId: object.split(':')[1],
        entityType: object.split(':')[0],
        relation: relation,
      });
    }
    if (!objectDefinition.permissions) return;
    const permissions = Object.keys(objectDefinition.permissions);
    const relatedPermissions: { [key: string]: string[] } = {};
    const obj = [];
    for (const permission of permissions) {
      const roles = objectDefinition.permissions[permission];
      for (const role of roles) {
        if (role.indexOf('->') === -1) {
          obj.push(constructObjectIndex(object, permission, role, object, []));
        } else if (role !== '*') {
          const [relatedSubject, action] = role.split('->');
          if (relation !== relatedSubject) continue;
          if (!relatedPermissions[action]) {
            relatedPermissions[action] = [permission];
          } else if (!relatedPermissions[action].includes(permission)) {
            relatedPermissions[action].push(permission);
          }
        }
      }
    }

    const indexes = await ObjectIndex.getInstance().findMany({
      $and: [
        { subject: { $in: obj.map(i => i.subject) } },
        { entity: { $in: obj.map(i => i.entity) } },
      ],
    });
    const toCreate = obj.filter(
      i => !indexes.find(j => j.subject === i.subject && j.entity === i.entity),
    );
    await ObjectIndex.getInstance().createMany(toCreate);
    const achievedPermissions = [...new Set(obj.map(i => i.subjectPermission!))];
    await QueueController.getInstance().addPossibleConnectionJob(
      object,
      subject,
      relation,
      relatedPermissions,
      achievedPermissions,
    );
  }

  async removeRelation(subject: string, relation: string, object: string) {
    // delete applicable actor indexes
    await ActorIndex.getInstance().deleteMany({
      subject: subject,
      entity: `${object}#${relation}`,
    });
    // delete object indexes that were created due to this relation
    await ObjectIndex.getInstance().deleteMany({
      inheritanceTree: `${subject}#${relation}@${object}`,
    });
  }

  async removeResource(resourceName: string) {
    const escapedResourceName = this.escapeRegex(resourceName);
    const query = {
      $or: [
        {
          subjectType: resourceName,
        },
        { entityType: resourceName },
      ],
    };
    await ActorIndex.getInstance().deleteMany(query);
    await ObjectIndex.getInstance().deleteMany(query);
    // delete object indexes that were created due to this relation
    await ObjectIndex.getInstance().deleteMany({
      $or: [
        {
          inheritanceTree: {
            $regex: `^${escapedResourceName}:`,
          },
        },
        {
          inheritanceTree: {
            $regex: `@${escapedResourceName}:`,
          },
        },
      ],
    });
  }

  async findIndex(subject: string, action: string, object: string) {
    const objectSubject = `${object}#${action}`;
    const wildcardIndex = await ObjectIndex.getInstance().findOne({
      subject: objectSubject,
      entity: '*',
    });
    if (wildcardIndex) return true;

    const objectIndexes = await ObjectIndex.getInstance().findMany({
      subject: objectSubject,
    });
    if (!objectIndexes.length) return false;

    const candidateEntities = this.uniqueEntities(
      objectIndexes.map(index => index.entity).filter(entity => entity !== '*'),
    );
    if (!candidateEntities.length) return false;

    const matchingActorIndex = await ActorIndex.getInstance().findOne({
      subject: subject,
      entity: { $in: candidateEntities },
    });
    return !!matchingActorIndex;
  }

  async evaluateIndex(subject: string, action: string, object: string) {
    const objectSubject = `${object}#${action}`;
    const wildcardIndex = await ObjectIndex.getInstance().findOne({
      subject: objectSubject,
      entity: '*',
    });
    if (wildcardIndex) {
      return {
        subject: null,
        object: wildcardIndex,
      };
    }

    const objectIndexes = await ObjectIndex.getInstance().findMany({
      subject: objectSubject,
    });
    if (!objectIndexes.length) {
      return {
        subject: null,
        object: null,
      };
    }

    const candidateEntities = this.uniqueEntities(
      objectIndexes.map(index => index.entity).filter(entity => entity !== '*'),
    );
    if (!candidateEntities.length) {
      return {
        subject: null,
        object: null,
      };
    }

    const subjectIndex = await ActorIndex.getInstance().findOne({
      subject: subject,
      entity: { $in: candidateEntities },
    });
    if (!subjectIndex) {
      return {
        subject: null,
        object: null,
      };
    }

    const objectIndex =
      objectIndexes.find(index => index.entity === subjectIndex.entity) ?? null;
    return {
      subject: subjectIndex,
      object: objectIndex,
    };
  }

  async findGeneralIndex(
    subject: string,
    action: string,
    objectType: string,
    skip: number,
    limit: number,
  ) {
    const actorEntities = await this.resolveActorEntities(subject);
    const objectIndexes = await this.findObjectIndexesByEntities(
      {
        subjectType: objectType,
        subjectPermission: action,
      },
      [...actorEntities, '*'],
    );
    const uniqueResourceIds = [
      ...new Set(objectIndexes.map(index => this.extractResourceId(index.subject))),
    ];
    return uniqueResourceIds.slice(skip, skip + limit);
  }

  async findGeneralIndexCount(subject: string, action: string, objectType: string) {
    const actorEntities = await this.resolveActorEntities(subject);
    const objectIndexes = await this.findObjectIndexesByEntities(
      {
        subjectType: objectType,
        subjectPermission: action,
      },
      [...actorEntities, '*'],
    );
    return new Set(objectIndexes.map(index => this.extractResourceId(index.subject)))
      .size;
  }
}
