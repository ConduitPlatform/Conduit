import { Job, Processor } from 'bullmq';
import { ObjectIndex, ResourceDefinition } from '../models/index.js';
import { constructObjectIndex } from '../utils/index.js';
import { omit } from 'lodash-es';

export type ProcessPossibleConnectionsWorkerData = {
  object: string;
  subject: string;
  relation: string;
  relatedPermissions: { [key: string]: string[] };
  achievedPermissions: string[];
};

export function createProcessPossibleConnectionsProcessor(): Processor<ProcessPossibleConnectionsWorkerData> {
  return async (job: Job<ProcessPossibleConnectionsWorkerData>) => {
    const {
      object,
      subject,
      relation,
      relatedPermissions,
      achievedPermissions: providedAchievedPermissions,
    } = job.data;
    const subjectDefinition = (await ResourceDefinition.getInstance().findOne({
      name: subject.split(':')[0],
    }))!;
    const connectionSubjects = Object.keys(relatedPermissions).map(
      i => `${subject}#${i}`,
    );
    const fetchConnections = () =>
      ObjectIndex.getInstance().findMany(
        { subject: { $in: connectionSubjects } },
        { readPreference: 'primary' },
      );
    const rowsFromConnections = (connections: ObjectIndex[]) => {
      const rows: Partial<ObjectIndex>[] = [];
      for (const action in relatedPermissions) {
        for (const connection of connections) {
          if (connection.subjectPermission !== action) continue;
          for (const permission of relatedPermissions[action]) {
            rows.push(
              constructObjectIndex(
                object,
                permission,
                connection.entity.split('#')[1],
                connection.entity.split('#')[0],
                [
                  ...(connection.inheritanceTree ?? []),
                  `${subject}#${relation}@${object}`,
                ],
              ),
            );
          }
        }
      }
      return rows;
    };
    const rowsFromSubjectDefinition: Partial<ObjectIndex>[] = [];
    if (subjectDefinition.permissions) {
      const subjectPermissions = Object.keys(subjectDefinition.permissions);
      for (const action in relatedPermissions) {
        if (!subjectPermissions.includes(action)) continue;
        for (const role of subjectDefinition.permissions[action]) {
          if (role.indexOf('->') !== -1) continue;
          for (const permission of relatedPermissions[action]) {
            rowsFromSubjectDefinition.push({
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

    // Write before the final read: a parent job (one that just gave `subject` new
    // entities) looks for this object's rows only after writing its own. Reading the
    // connections again after our write guarantees one of the two jobs sees the other,
    // so the object cannot end up without the parent's entities.
    const connections = await fetchConnections();
    const obj = uniqueRows([
      ...rowsFromConnections(connections),
      ...rowsFromSubjectDefinition,
    ]);
    await createMissingRows(obj);
    const seenConnections = new Set(connections.map(connectionKey));
    const lateConnections = (await fetchConnections()).filter(
      connection => !seenConnections.has(connectionKey(connection)),
    );
    if (lateConnections.length) {
      const known = new Set(obj.map(rowKey));
      const lateRows = uniqueRows(rowsFromConnections(lateConnections)).filter(
        row => !known.has(rowKey(row)),
      );
      await createMissingRows(lateRows);
      obj.push(...lateRows);
    }

    const achievedPermissions = [
      ...new Set([...providedAchievedPermissions, ...obj.map(i => i.subjectPermission!)]),
    ];
    const objectsByPermission: { [key: string]: Partial<ObjectIndex>[] } = {};
    for (const permission of achievedPermissions) {
      objectsByPermission[permission] = obj.filter(
        i => i.subjectPermission === permission,
      );
    }
    for (const objectPermission in objectsByPermission) {
      const childObj: Partial<ObjectIndex>[] = [];
      const childIndexes = await ObjectIndex.getInstance().findMany(
        {
          subject: { $ne: `${object}#${objectPermission}` },
          entityId: object.split(':')[1],
          entityType: object.split(':')[0],
          entityPermission: objectPermission,
        },
        { readPreference: 'primary' },
      );
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
            // the path to `object`, then the child's own path from `object` down
            inheritanceTree: [
              ...(childObject.inheritanceTree ?? []),
              ...(copy.inheritanceTree ?? []),
            ],
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
      const childIndexes2 = await ObjectIndex.getInstance().findMany(
        {
          $and: [
            { subject: { $in: childUnique.map(i => i.subject) } },
            { entity: { $in: childUnique.map(i => i.entity) } },
          ],
        },
        { readPreference: 'primary' },
      );
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
}

function rowKey(row: Partial<ObjectIndex>) {
  return `${row.subject}#${row.entity}${(row.inheritanceTree ?? []).join('')}`;
}

function connectionKey(connection: ObjectIndex) {
  return rowKey(connection);
}

/**
 * Deduplicates by subject, entity and inheritance tree. When a connection row and a
 * subject-definition row collide, keep the one carrying `entityPermission`: it is the
 * marker the child-propagation query matches on, and dropping it means a parent that
 * gains entities later can never push them down to this object.
 */
function uniqueRows(rows: Partial<ObjectIndex>[]) {
  const byKey = new Map<string, Partial<ObjectIndex>>();
  for (const row of rows) {
    const key = rowKey(row);
    const existing = byKey.get(key);
    if (!existing || (!existing.entityPermission && row.entityPermission)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

async function createMissingRows(rows: Partial<ObjectIndex>[]) {
  if (!rows.length) return;
  const indexes = await ObjectIndex.getInstance().findMany(
    {
      $and: [
        { subject: { $in: rows.map(i => i.subject) } },
        { entity: { $in: rows.map(i => i.entity) } },
      ],
    },
    { readPreference: 'primary' },
  );
  const existing = new Set(indexes.map(rowKey));
  const toCreate = rows.filter(row => !existing.has(rowKey(row)));
  if (toCreate.length) {
    await ObjectIndex.getInstance().createMany(toCreate);
  }
}
