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
  const actorLookup: any = {};
  let namedObjectDefinitions: { [key: string]: ResourceDefinition } = {};
  for (const definition of objectDefinitions) {
    namedObjectDefinitions[definition.name] = definition;
  }
  for (const r of relations) {
    relationObjects.push(r.object);
    const entity = `${r.object}#${r.relation}`;
    actorLookup[entity] = r;
    const objectName = r.object.split(':')[0];
    const permissions = Object.values(namedObjectDefinitions[objectName].permissions);
    for (const roles of permissions) {
      for (const role of roles) {
        if (role.indexOf('->') !== -1 && role !== '*') {
          const [relatedSubject, action] = role.split('->');
          if (
            r.relation === relatedSubject &&
            possibleConnectionSubjects.indexOf(`${r.subject}#${action}`) === -1
          ) {
            possibleConnectionSubjects.push(`${r.subject}#${action}`);
          }
        }
      }
    }
  }
  const found = await ActorIndex.getInstance().findMany({
    $and: [
      {
        subject: {
          $in: [...Object.keys(actorLookup).map(key => actorLookup[key].subject)],
        },
      },
      { entity: { $in: Object.keys(actorLookup) } },
    ],
  });
  for (const entity in actorLookup) {
    const r = actorLookup[entity];
    const foundActor = found.find(a => a.subject === r.subject && a.entity === entity);
    if (foundActor) continue;
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
  //todo instead of blindly searching for actors, we should only search for actors that have the same permissions we just inherited
  // todo create anchor points. ex. if you have relation X in object Y, you get permission Z in object A, because object Y has permission Z in object A and it's inherited
  const actors = await ActorIndex.getInstance().findMany({
    subject: { $in: relationObjects },
  });
  if (actors.length === 0) return;
  // split into chunks of 500
  const chunks = [];
  for (let i = 0; i < actors.length; i += 100) {
    chunks.push(actors.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    await QueueController.getInstance().addRelationIndexJob(
      chunk.map(actor => ({
        subject: actor.subject,
        relation: actor.relation,
        object: actor.entity.split('#')[0],
      })),
    );
  }
  // await QueueController.getInstance().addRelationIndexJob(
  //   actors.map(actor => ({
  //     subject: actor.subject,
  //     relation: actor.relation,
  //     object: actor.entity.split('#')[0],
  //   })),
  // );
};
