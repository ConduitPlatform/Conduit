import { SandboxedJob } from 'bullmq';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ActorIndex, ObjectIndex, ResourceDefinition } from '../models';
import { QueueController } from '../controllers';

type ConstructRelationIndexWorkerData = {
  relations: { subject: string; relation: string; object: string }[];
};

module.exports = async (job: SandboxedJob<ConstructRelationIndexWorkerData>) => {
  const { relations } = job.data;
  if (!process.env.CONDUIT_SERVER) throw new Error('No serverUrl provided!');
  const grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'authorization', false);
  await grpcSdk.initialize();
  await grpcSdk.initializeEventBus();
  await grpcSdk.waitForExistence('database');
  ObjectIndex.getInstance(grpcSdk.database!);
  ActorIndex.getInstance(grpcSdk.database!);
  ResourceDefinition.getInstance(grpcSdk.database!);
  QueueController.getInstance(grpcSdk);

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
  await QueueController.getInstance().addRelationIndexJob(
    actors.map(actor => ({
      subject: actor.subject,
      relation: actor.relation,
      object: actor.entity.split('#')[0],
    })),
  );
};
