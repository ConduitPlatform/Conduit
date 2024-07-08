import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  ActorIndex,
  ObjectIndex,
  Relationship,
  ResourceDefinition,
} from '../models/index.js';
import { constructObjectIndex } from '../utils/index.js';
import { QueueController } from './queue.controller.js';

export class IndexController {
  private static _instance: IndexController;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

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
            $regex: `${resourceName}.*`,
            $options: 'i',
          },
        },
        {
          inheritanceTree: {
            $regex: `.*@${resourceName}.*`,
            $options: 'i',
          },
        },
      ],
    });
  }

  async findIndex(subject: string, action: string, object: string) {
    const subjectDefinition = await ActorIndex.getInstance().findMany({
      subject: subject,
    });

    const objectDefinition = await ObjectIndex.getInstance().findOne({
      subject: object + '#' + action,
      entity: { $in: [...subjectDefinition.map(index => index.entity), '*'] },
    });
    return !!objectDefinition;
  }

  async findGeneralIndex(
    subject: string,
    action: string,
    objectType: string,
    skip: number,
    limit: number,
  ) {
    const subjectDefinition = await ActorIndex.getInstance().findMany({
      subject: subject,
    });

    const objectDefinition = await ObjectIndex.getInstance().findMany(
      {
        subjectType: objectType,
        subjectPermission: action,
        entity: { $in: [...subjectDefinition.map(index => index.entity), '*'] },
      },
      undefined,
      skip,
      limit,
    );
    return objectDefinition.map(index => index.subject.split('#')[0].split(':')[1]);
  }

  async findGeneralIndexCount(subject: string, action: string, objectType: string) {
    const subjectDefinition = await ActorIndex.getInstance().findMany({
      subject: subject,
    });

    return await ObjectIndex.getInstance().countDocuments({
      subjectType: objectType,
      subjectPermission: action,
      entity: { $in: [...subjectDefinition.map(index => index.entity), '*'] },
    });
  }
}
