import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ActorIndex, ObjectIndex, ResourceDefinition } from '../models';
import { RelationsController } from './relations.controller';

export class IndexController {
  private static _instance: IndexController;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  private _relationsController: RelationsController;

  set relationsController(relationsController: RelationsController) {
    this._relationsController = relationsController;
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (IndexController._instance) return IndexController._instance;
    if (grpcSdk) {
      return (IndexController._instance = new IndexController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
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
        entityId: entity.split(':')[1].split('#')[0],
        entityType: entity.split(':')[0],
        relation: entity.split('#')[1],
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
    const permissions = Object.keys(objectDefinition.permissions);
    const obj = [];
    for (const permission of permissions) {
      const roles = objectDefinition.permissions[permission];
      for (const role of roles) {
        if (role.indexOf('->') === -1) {
          obj.push({
            subject: `${object}#${permission}`,
            subjectId: object.split(':')[1],
            subjectType: `${object}#${permission}`.split(':')[0],
            subjectPermission: `${object}#${permission}`.split('#')[1],
            entity: `${object}#${role}`,
            entityId: object.split(':')[1],
            entityType: `${object}#${role}`.split(':')[0],
            relation: `${object}#${role}`.split('#')[1],
          });
        } else if (role !== '*') {
          const [relatedSubject, action] = role.split('->');
          if (relation !== relatedSubject) continue;
          const possibleConnections = await ObjectIndex.getInstance().findMany({
            subject: `${subject}#${action}`,
          });
          for (const connection of possibleConnections) {
            obj.push({
              subject: `${object}#${permission}`,
              subjectId: object.split(':')[1],
              subjectType: `${object}#${permission}`.split(':')[0],
              subjectPermission: `${object}#${permission}`.split('#')[1],
              entity: connection.entity,
              entityId: connection.entity.split(':')[1].split('#')[0],
              entityType: connection.entity.split(':')[0],
              relation: connection.entity.split('#')[1],
            });
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
    const actors = await ActorIndex.getInstance().findMany({
      subject: object,
    });
    if (actors.length === 0) return;
    await this.constructRelationIndexes(
      actors.map(actor => ({
        subject: actor.subject,
        relation: actor.relation,
        object: actor.entity.split('#')[0],
      })),
    );
  }

  async constructRelationIndexes(
    relations: { subject: string; relation: string; object: string }[],
  ) {
    const objectNames = relations.map(r => r.object.split(':')[0]);
    const objectDefinitions = await ResourceDefinition.getInstance().findMany({
      name: { $in: objectNames },
    });
    const obj = [];
    const possibleConnectionSubjects = [];
    const actorsToCreate = [];
    const relationObjects: string[] = [];
    for (const r of relations) {
      relationObjects.push(r.object);
      const entity = `${r.object}#${r.relation}`;
      const objectDefinition = objectDefinitions.find(
        o => o.name === r.object.split(':')[0],
      )!;
      const permissions = Object.keys(objectDefinition.permissions);
      for (const permission of permissions) {
        const roles = objectDefinition.permissions[permission];
        for (const role of roles) {
          if (role.indexOf('->') !== -1 && role !== '*') {
            const [relatedSubject, action] = role.split('->');
            if (r.relation === relatedSubject) {
              possibleConnectionSubjects.push(`${r.subject}#${action}`);
            }
          }
        }
      }
      const found = await ActorIndex.getInstance().findMany({
        $and: [{ subject: r.subject }, { entity }],
      });
      const exists = found.find(f => f.entity === entity);
      if (!exists) {
        actorsToCreate.push({
          subject: r.subject,
          subjectId: r.subject.split(':')[1].split('#')[0],
          subjectType: r.subject.split(':')[0],
          entity,
          entityId: entity.split(':')[1].split('#')[0],
          entityType: entity.split(':')[0],
          relation: r.relation,
        });
      }
    }
    await ActorIndex.getInstance().createMany(actorsToCreate);
    const possibleConnections = await ObjectIndex.getInstance().findMany({
      subject: { $in: possibleConnectionSubjects },
    });
    for (const r of relations) {
      const objectDefinition = objectDefinitions.find(
        o => o.name === r.object.split(':')[0],
      )!;
      const permissions = Object.keys(objectDefinition.permissions);
      for (const permission of permissions) {
        const roles = objectDefinition.permissions[permission];
        for (const role of roles) {
          if (role.indexOf('->') === -1) {
            obj.push({
              subject: `${r.object}#${permission}`,
              subjectId: r.object.split(':')[1],
              subjectType: `${r.object}#${permission}`.split(':')[0],
              subjectPermission: `${r.object}#${permission}`.split('#')[1],
              entity: `${r.object}#${role}`,
              entityId: r.object.split(':')[1],
              entityType: `${r.object}#${role}`.split(':')[0],
              relation: `${r.object}#${role}`.split('#')[1],
            });
          } else if (role !== '*') {
            const [relatedSubject, action] = role.split('->');
            if (r.relation !== relatedSubject) continue;
            const relationConnections = possibleConnections.filter(
              connection => connection.subject === `${r.subject}#${action}`,
            );
            for (const connection of relationConnections) {
              obj.push({
                subject: `${r.object}#${permission}`,
                subjectId: r.object.split(':')[1],
                subjectType: `${r.object}#${permission}`.split(':')[0],
                subjectPermission: `${r.object}#${permission}`.split('#')[1],
                entity: connection.entity,
                entityId: connection.entity.split(':')[1].split('#')[0],
                entityType: connection.entity.split(':')[0],
                relation: connection.entity.split('#')[1],
              });
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
    const objectsToCreate = obj.filter(
      i => !indexes.find(j => j.subject === i.subject && j.entity === i.entity),
    );
    await ObjectIndex.getInstance().createMany(objectsToCreate);
    const actors = await ActorIndex.getInstance().findMany({
      subject: { $in: relationObjects },
    });
    if (actors.length === 0) return;
    await this.constructRelationIndexes(
      actors.map(actor => ({
        subject: actor.subject,
        relation: actor.relation,
        object: actor.entity.split('#')[0],
      })),
    );
  }

  async removeRelation(subject: string, relation: string, object: string) {
    // delete applicable actor indexes
    await ActorIndex.getInstance().deleteMany({
      subject: subject,
      entity: `${object}#${relation}`,
    });
  }

  async removeGeneralRelation(
    subjectResource: string,
    relation: string,
    objectResource: string,
  ) {
    // delete applicable actor indexes
    await ActorIndex.getInstance().deleteMany({
      $or: [
        {
          subject: {
            $regex: `${subjectResource}.*`,
            $options: 'i',
          },
        },
        { entity: { $regex: `${objectResource}.*#${relation}`, $options: 'i' } },
      ],
    });
  }

  async _processRemovedPermissions(
    removedRoles: string[],
    permission: string,
    resource: ResourceDefinition,
    oldResource: ResourceDefinition,
  ) {
    // for all roles that are no longer valid for a specific permission
    // remove all applicable actor indexes
    if (removedRoles.length > 0) {
      for (const removedRole of removedRoles) {
        if (removedRole.indexOf('->') === -1) {
          await ObjectIndex.getInstance().deleteMany({
            subject: {
              $regex: `${resource.name}.*#${permission}`,
              $options: 'i',
            },
            entity: {
              $regex: `${resource.name}.*#${removedRole}`,
              $options: 'i',
            },
          });
        } else {
          const [relatedSubject, action] = removedRole.split('->');
          const removedResources = oldResource.relations[relatedSubject];
          for (const removedResource of removedResources) {
            await ObjectIndex.getInstance().deleteMany({
              subject: {
                $regex: `${resource.name}.*#${permission}`,
                $options: 'i',
              },
              entity: {
                $regex: `${removedResource}.*#${action}`,
                $options: 'i',
              },
            });
          }
        }
      }
    }
  }

  async _processAddPermission(
    addedRoles: string[],
    permission: string,
    resource: ResourceDefinition,
  ) {
    // for all roles that are newly valid for a specific permission
    // add all applicable actor indexes
    if (addedRoles.length > 0) {
      for (const addedRole of addedRoles) {
        if (addedRole.indexOf('->') === -1) {
          await this.createOrUpdateObject(
            resource.name + '#' + permission,
            addedRole === '*' ? `*` : `${resource.name}#${addedRole}`,
          );
        } else {
          const [relatedSubject, action] = addedRole.split('->');
          const addedResources = resource.relations[relatedSubject];

          for (const addedResource of addedResources) {
            const possibleConnections = await ObjectIndex.getInstance().findMany({
              subject: `${addedResource}.*#${action}`,
            });
            const applicableObjects = await ObjectIndex.getInstance().findMany({
              subject: `${resource.name}.*`,
            });
            let objectNames: string[] = [];
            if (applicableObjects.length > 0) {
              objectNames = applicableObjects.map(object => {
                return object.subject.split('#')[0];
              });
            }
            for (const object of objectNames) {
              for (const connection of possibleConnections) {
                await this.createOrUpdateObject(
                  object + '#' + permission,
                  connection.entity,
                );
              }
            }
          }
        }
      }
    }
  }

  async modifyPermission(oldResource: any, resource: any) {
    const oldPermissions = oldResource.permissions;
    const newPermissions = resource.permissions;
    const oldPermissionNames = Object.keys(oldPermissions);
    const newPermissionNames = Object.keys(newPermissions);
    const removedPermissions = oldPermissionNames.filter(
      permission => !newPermissionNames.includes(permission),
    );
    const modifiedPermissions = newPermissionNames.filter(
      permission => !oldPermissionNames.includes(permission),
    );
    // remove all permissions that are no longer present
    for (const permission of removedPermissions) {
      await ObjectIndex.getInstance().deleteMany({
        subject: {
          $regex: `${resource}.*#${permission}`,
          $options: 'i',
        },
      });
    }
    for (const permission of modifiedPermissions) {
      // check if any roles are no longer valid for a specific permission
      if (oldPermissions[permission] !== newPermissions[permission]) {
        let oldRoleNames: string[] = [];
        if (oldPermissions[permission]) {
          oldRoleNames = Object.keys(oldPermissions[permission]);
        }
        let newRoleNames: string[] = [];
        if (newPermissions[permission]) {
          newRoleNames = Object.keys(newPermissions[permission]);
        }
        const removedRoles = oldRoleNames.filter(role => !newRoleNames.includes(role));
        await this._processRemovedPermissions(
          removedRoles,
          permission,
          resource,
          oldResource,
        );
        const addedRoles = newRoleNames.filter(role => !oldRoleNames.includes(role));
        await this._processAddPermission(addedRoles, permission, resource);
      }
    }
  }

  async modifyRelations(oldResource: any, resource: any) {
    const oldRelations = oldResource.relations;
    const newRelations = resource.relations;
    const oldRelationNames = Object.keys(oldRelations);
    const newRelationNames = Object.keys(newRelations);
    const removedRelations = oldRelationNames.filter(
      relation => !newRelationNames.includes(relation),
    );
    const modifiedRelations = newRelationNames.filter(relation =>
      oldRelationNames.includes(relation),
    );
    // remove all relations that are no longer present
    for (const relation of removedRelations) {
      for (const relationResource of oldRelations[relation]) {
        await this.removeGeneralRelation(relationResource, relation, resource.name);
      }
    }
    for (const relation of modifiedRelations) {
      // check if any resources are no longer valid for a specific relation
      if (oldRelations[relation] !== newRelations[relation]) {
        const oldResourceNames = Object.keys(oldRelations[relation]);
        const newResourceNames = Object.keys(newRelations[relation]);
        const removedResources = oldResourceNames.filter(
          resource => !newResourceNames.includes(resource),
        );
        // for all resources that are no longer valid for a specific relation
        // remove all applicable actor indexes
        if (removedResources.length > 0) {
          for (const removedResource of removedResources) {
            await this.removeGeneralRelation(removedResource, relation, resource.name);
            await this._relationsController.removeGeneralRelation(
              removedResource,
              relation,
              resource.name,
            );
          }
        }
      }
    }
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
