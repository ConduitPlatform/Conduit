import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ResourceDefinition, ActorIndex, ObjectIndex, Relationship } from '../models';
import { RelationsController } from './relations.controller';

export class IndexController {
  private static _instance: IndexController;

  private constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly relationsController = RelationsController.getInstance(grpcSdk),
  ) {}

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (IndexController._instance) return IndexController._instance;
    if (grpcSdk) {
      return (IndexController._instance = new IndexController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  async createOrUpdateObject(subject: string, entity: string) {
    let index = await ObjectIndex.getInstance().findOne({ subject, entity });
    if (!index) {
      await ObjectIndex.getInstance().create({ subject, entity });
    }
  }

  async constructRelationIndex(subject: string, relation: string, object: string) {
    let objectDefinition = (await ResourceDefinition.getInstance().findOne({
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
        entity: `${object}#${relation}`,
      });
    }
    let permissions = Object.keys(objectDefinition.permissions);
    for (const permission of permissions) {
      let roles = objectDefinition.permissions[permission];
      for (const role of roles) {
        // no index needed for "allowAll" permissions
        // or for self modification
        if (role === '*' || role.indexOf('->') === -1) {
          await this.createOrUpdateObject(
            object + '#' + permission,
            role === '*' ? `*` : `${object}#${role}`,
          );
        } else {
          let [relatedSubject, action] = role.split('->');
          if (relation !== relatedSubject) continue;
          let possibleConnections = await ObjectIndex.getInstance().findMany({
            subject: `${subject}#${action}`,
          });
          for (const connection of possibleConnections) {
            await this.createOrUpdateObject(object + '#' + permission, connection.entity);
          }
        }
      }
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
        { resource: { $regex: `${objectResource}.*#${relation}`, $options: 'i' } },
      ],
    });
  }

  async modifyPermission(oldResource: any, resource: any) {
    let oldPermissions = oldResource.permissions;
    let newPermissions = resource.permissions;
    let oldPermissionNames = Object.keys(oldPermissions);
    let newPermissionNames = Object.keys(newPermissions);
    let removedPermissions = oldPermissionNames.filter(
      permission => !newPermissionNames.includes(permission),
    );
    let modifiedPermissions = newPermissionNames.filter(
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
        let oldRoleNames = Object.keys(oldPermissions[permission]);
        let newRoleNames = Object.keys(newPermissions[permission]);
        let removedRoles = oldRoleNames.filter(role => !newRoleNames.includes(role));
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
              let [relatedSubject, action] = removedRole.split('->');
              let removedResources = oldResource.relations[relatedSubject];
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
        let addedRoles = newRoleNames.filter(role => !oldRoleNames.includes(role));
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
              let [relatedSubject, action] = addedRole.split('->');
              let addedResources = resource.relations[relatedSubject];

              for (const addedResource of addedResources) {
                let possibleConnections = await ObjectIndex.getInstance().findMany({
                  subject: `${addedResource}.*#${action}`,
                });
                let applicableObjects = await ObjectIndex.getInstance().findMany({
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
    }
  }

  async modifyRelations(oldResource: any, resource: any) {
    let oldRelations = oldResource.relations;
    let newRelations = resource.relations;
    let oldRelationNames = Object.keys(oldRelations);
    let newRelationNames = Object.keys(newRelations);
    let removedRelations = oldRelationNames.filter(
      relation => !newRelationNames.includes(relation),
    );
    let modifiedRelations = newRelationNames.filter(relation =>
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
        let oldResourceNames = Object.keys(oldRelations[relation]);
        let newResourceNames = Object.keys(newRelations[relation]);
        let removedResources = oldResourceNames.filter(
          resource => !newResourceNames.includes(resource),
        );
        // for all resources that are no longer valid for a specific relation
        // remove all applicable actor indexes
        if (removedResources.length > 0) {
          for (const removedResource of removedResources) {
            await this.removeGeneralRelation(removedResource, relation, resource.name);
            await this.relationsController.removeGeneralRelation(
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
    let subjectDefinition = await ActorIndex.getInstance().findMany({
      subject: subject,
    });

    let objectDefinition = await ObjectIndex.getInstance().findOne({
      subject: object + '#' + action,
      entity: { $in: [...subjectDefinition?.map(index => index.entity), '*'] },
    });
    return !!objectDefinition;
  }
}
