import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ResourceDefinition, ActorIndex, ObjectIndex } from '../models';

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

  async constructRelationIndex(subject: string, relation: string, object: string) {
    let subjectDefinition = await ResourceDefinition.getInstance().findOne({
      name: subject.split(':')[0],
    });
    let objectDefinition = (await ResourceDefinition.getInstance().findOne({
      name: object.split(':')[0],
    }))!;
    // relations can only be created between actors and resources
    // object indexes represent relations between actors and permissions on resources
    // construct actor index
    await ActorIndex.getInstance().create({
      subject: subject,
      entity: `${object}#${relation}`,
    });

    let permissions = Object.keys(objectDefinition.permissions);
    for (const permission of permissions) {
      if (Array.isArray(objectDefinition.permissions[permission])) {
        let roles = objectDefinition.permissions[permission];
        for (const role of roles) {
          // no index needed for "allowAll" permissions
          // or for self modification
          if (role === '*' || role === '_self') continue;
          if (role.indexOf('->') === -1) {
            await ObjectIndex.getInstance().create({
              subject: object + '#' + permission,
              entity: `${object}#${role}`,
            });
          } else {
            let [relatedSubject, action] = role.split('->');
            if (relation !== relatedSubject) continue;

            let possibleConnections = await ObjectIndex.getInstance().findMany({
              subject: `${subject}#${action}`,
            });
            for (const connection of possibleConnections) {
              await ObjectIndex.getInstance().create({
                subject: object + '#' + permission,
                entity: connection.entity,
              });
            }
          }
        }
      } else {
        // no index needed for "allowAll" permissions
        // or for self modification
        if (permission === '*' || permission === '_self') continue;
        if (permission.indexOf('->') === -1) {
          await ObjectIndex.getInstance().create({
            subject: object + '#' + permission,
            entity: `${object}#${objectDefinition.permissions[permission]}`,
          });
        } else {
          let [relatedSubject, action] = permission.split('->');
          if (relation !== relatedSubject) continue;
          let possibleConnections = await ObjectIndex.getInstance().findMany({
            subject: `${subject}#${action}`,
          });
          for (const connection of possibleConnections) {
            await ObjectIndex.getInstance().create({
              subject: object + '#' + permission,
              entity: connection.entity,
            });
          }
        }
      }
    }
  }

  async removeRelationIndex(subject: string, relation: string, object: string) {
    let subjectDefinition = await ResourceDefinition.getInstance().findOne({
      name: subject.split(':')[0],
    });
    // construct actor index
    await ActorIndex.getInstance().deleteOne({
      index: {
        [subject]: `${object}#${relation}`,
      },
    });
    if (Object.keys(subjectDefinition!.relations).length === 0) {
    } else {
      // delete object indices
    }
  }

  async findIndex(subject: string, action: string, object: string) {
    let subjectDefinition = await ActorIndex.getInstance().findMany({
      subject: subject,
    });

    let objectDefinition = await ObjectIndex.getInstance().findOne({
      subject: object + '#' + action,
      entity: { $in: subjectDefinition.map(index => index.entity) },
    });
    if (objectDefinition) return true;
    return false;
  }
}
