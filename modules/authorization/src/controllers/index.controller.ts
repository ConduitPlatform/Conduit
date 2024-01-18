import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ActorIndex, ObjectIndex, Relationship, ResourceDefinition } from '../models';
import { constructObjectIndex } from '../utils';
import _ from 'lodash';
import { QueueController } from './queue.controller';

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

    const subjectDefinition = (await ResourceDefinition.getInstance().findOne({
      name: subject.split(':')[0],
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
    const possibleConnections = await ObjectIndex.getInstance().findMany({
      subject: { $in: Object.keys(relatedPermissions).map(i => `${subject}#${i}`) },
    });
    for (const action in relatedPermissions) {
      for (const connection of possibleConnections) {
        if (connection.subjectPermission !== action) continue;
        for (const permission of relatedPermissions[action]) {
          obj.push(
            constructObjectIndex(
              object,
              permission,
              connection.entity.split('#')[1],
              connection.entity.split('#')[0],
              [...connection.inheritanceTree, `${subject}#${relation}@${object}`],
            ),
          );
        }
      }
    }
    if (subjectDefinition.permissions) {
      const subjectPermissions = Object.keys(subjectDefinition.permissions);
      for (const action in relatedPermissions) {
        if (subjectPermissions.includes(action)) {
          for (const role of subjectDefinition.permissions[action]) {
            if (role.indexOf('->') === -1) {
              for (const permission of relatedPermissions[action]) {
                obj.push({
                  subject: `${object}#${permission}`,
                  subjectId: object.split(':')[1],
                  subjectType: `${object}#${permission}`.split(':')[0],
                  subjectPermission: `${object}#${permission}`.split('#')[1],
                  entity: `${subject}#${role}`,
                  entityId: subject.split(':')[1],
                  entityType: `${subject}#${role}`.split(':')[0],
                  entityPermission: action,
                  relation: `${subject}#${role}`.split('#')[1],
                  inheritanceTree: [`${subject}#${relation}@${object}`],
                });
              }
            }
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
    const objectsByPermission: { [key: string]: Partial<ObjectIndex>[] } = {};
    for (const permission of achievedPermissions) {
      objectsByPermission[permission] = obj.filter(
        i => i.subjectPermission === permission,
      );
    }
    for (const objectPermission in objectsByPermission) {
      const childObj: Partial<ObjectIndex>[] = [];
      const childIndexes = await ObjectIndex.getInstance().findMany({
        subject: { $ne: `${object}#${objectPermission}` },
        entityId: object.split(':')[1],
        entityType: object.split(':')[0],
        entityPermission: objectPermission,
      });
      for (const childIndex of childIndexes) {
        const copy = _.omit(childIndex, ['_id', 'createdAt', 'updatedAt', '__v']);
        for (const childObject of objectsByPermission[objectPermission]) {
          if (childObject.entityType === copy.entityType) continue;
          childObj.push({
            ...copy,
            entity: childObject.entity,
            entityId: childObject.entityId,
            entityType: childObject.entityType,
            entityPermission: childObject.entityPermission,
          });
        }
      }
      await ObjectIndex.getInstance().createMany(childObj);
    }
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
