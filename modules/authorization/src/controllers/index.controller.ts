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
        subjectPermission: subject.split('#')[1],
        entity,
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
        subjectType: subject.split(':')[0],
        entity: `${object}#${relation}`,
        entityType: object.split(':')[0],
        relation: relation,
      });
    }
    const permissions = Object.keys(objectDefinition.permissions);
    for (const permission of permissions) {
      const roles = objectDefinition.permissions[permission];
      for (const role of roles) {
        if (role.indexOf('->') === -1) {
          await this.createOrUpdateObject(object + '#' + permission, `${object}#${role}`);
        } else if (role !== '*') {
          const [relatedSubject, action] = role.split('->');
          if (relation !== relatedSubject) continue;
          const possibleConnections = await ObjectIndex.getInstance().findMany({
            subject: `${subject}#${action}`,
          });
          for (const connection of possibleConnections) {
            await this.createOrUpdateObject(object + '#' + permission, connection.entity);
          }
        }
      }
    }
    const actors = await ActorIndex.getInstance().findMany({
      subject: object,
    });
    if (actors.length === 0) return;
    for (const actor of actors) {
      await this.constructRelationIndex(
        actor.subject,
        actor.relation,
        actor.entity.split('#')[0],
      );
    }
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
    await ActorIndex.getInstance().deleteMany({
      $or: [
        {
          subject: {
            $regex: `${resourceName}.*`,
            $options: 'i',
          },
        },
        { entity: { $regex: `${resourceName}.*`, $options: 'i' } },
      ],
    });
    await ObjectIndex.getInstance().deleteMany({
      $or: [
        {
          subject: {
            $regex: `${resourceName}.*`,
            $options: 'i',
          },
        },
        { entity: { $regex: `${resourceName}.*`, $options: 'i' } },
      ],
    });
  }

  async findIndex(subject: string, action: string, object: string) {
    const subjectDefinition = await ActorIndex.getInstance().findMany({
      subject: subject,
    });

    const objectDefinition = await ObjectIndex.getInstance().findOne({
      subject: object + '#' + action,
      entity: { $in: [...subjectDefinition?.map(index => index.entity), '*'] },
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
        subject: { $like: `${objectType}:%#${action}` },
        entity: { $in: [...subjectDefinition?.map(index => index.entity), '*'] },
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
      subject: { $like: `${objectType}:%#${action}` },
      entity: { $in: [...subjectDefinition?.map(index => index.entity), '*'] },
    });
  }
}
