import { SandboxedJob } from 'bullmq';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ActorIndex, ObjectIndex, ResourceDefinition } from '../models/index.js';
import { IndexController, QueueController } from '../controllers/index.js';
import { constructObjectIndex } from '../utils/index.js';
import { omit } from 'lodash-es';

let grpcSdk: ConduitGrpcSdk | undefined = undefined;

type ConstructRelationIndexWorkerData = {
  object: string;
  subject: string;
  relation: string;
  relatedPermissions: { [key: string]: string[] };
  achievedPermissions: string[];
};

module.exports = async (job: SandboxedJob<ConstructRelationIndexWorkerData>) => {
  const {
    object,
    subject,
    relation,
    relatedPermissions,
    achievedPermissions: providedAchievedPermissions,
  } = job.data;
  if (!grpcSdk) {
    if (!process.env.CONDUIT_SERVER) throw new Error('No serverUrl provided!');
    grpcSdk = new ConduitGrpcSdk(process.env.CONDUIT_SERVER, 'authorization', false);
    await grpcSdk.initialize();
    await grpcSdk.initializeEventBus();
    await grpcSdk.waitForExistence('database');
    ObjectIndex.getInstance(grpcSdk.database!);
    ActorIndex.getInstance(grpcSdk.database!);
    ResourceDefinition.getInstance(grpcSdk.database!);
    IndexController.getInstance(grpcSdk);
    QueueController.getInstance(grpcSdk);
  }
  const subjectDefinition = (await ResourceDefinition.getInstance().findOne({
    name: subject.split(':')[0],
  }))!;
  const obj = [];
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
      if (!subjectPermissions.includes(action)) continue;
      for (const role of subjectDefinition.permissions[action]) {
        if (role.indexOf('->') !== -1) continue;
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
  // deduplicate obj array, deduplicate by subject and entity while also comparing inheritanceTree.
  // Different trees should not be considered duplicate indexes.
  const keys = obj.map(i => `${i.subject}#${i.entity}${i.inheritanceTree!.join('')}`);
  const unique = obj.filter(
    (i, index) =>
      keys.indexOf(`${i.subject}#${i.entity}${i.inheritanceTree!.join('')}`) === index,
  );

  const indexes = await ObjectIndex.getInstance().findMany({
    $and: [
      { subject: { $in: unique.map(i => i.subject) } },
      { entity: { $in: unique.map(i => i.entity) } },
    ],
  });
  const toCreate = unique.filter(
    i =>
      !indexes.find(
        j =>
          j.subject === i.subject &&
          j.entity === i.entity &&
          j.inheritanceTree!.join('') === i.inheritanceTree!.join(''),
      ),
  );
  await ObjectIndex.getInstance().createMany(toCreate);

  const achievedPermissions = [
    ...new Set([...providedAchievedPermissions, ...obj.map(i => i.subjectPermission!)]),
  ];
  const objectsByPermission: { [key: string]: Partial<ObjectIndex>[] } = {};
  for (const permission of achievedPermissions) {
    objectsByPermission[permission] = obj.filter(i => i.subjectPermission === permission);
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
      const copy = omit(childIndex, ['_id', 'createdAt', 'updatedAt', '__v']);
      for (const childObject of objectsByPermission[objectPermission]) {
        if (childObject.entityType === copy.entityType) continue;
        childObj.push({
          ...copy,
          entity: childObject.entity,
          entityId: childObject.entityId,
          entityType: childObject.entityType,
          entityPermission: childObject.entityPermission,
          inheritanceTree: childObject.inheritanceTree!,
        });
      }
    }
    const childKeys = childObj.map(
      i => `${i.subject}#${i.entity}${i.inheritanceTree!.join('')}`,
    );
    // deduplicate childObj array
    const childUnique = childObj.filter(
      (i, index) =>
        childKeys.indexOf(`${i.subject}#${i.entity}${i.inheritanceTree!.join('')}`) ===
        index,
    );
    const childIndexes2 = await ObjectIndex.getInstance().findMany({
      $and: [
        { subject: { $in: childUnique.map(i => i.subject) } },
        { entity: { $in: childUnique.map(i => i.entity) } },
      ],
    });
    const childToCreate = childUnique.filter(
      i =>
        !childIndexes2.find(
          j =>
            j.subject === i.subject &&
            j.entity === i.entity &&
            j.inheritanceTree!.join('') === i.inheritanceTree!.join(''),
        ),
    );

    await ObjectIndex.getInstance().createMany(childToCreate);
  }
};
