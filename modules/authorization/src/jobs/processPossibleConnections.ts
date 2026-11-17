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
            rows.push({
              ...constructObjectIndex(
                object,
                permission,
                connection.entity.split('#')[1],
                connection.entity.split('#')[0],
                [
                  ...(connection.inheritanceTree ?? []),
                  `${subject}#${relation}@${object}`,
                ],
              ),
              // Same entity, granted through the same permission on it: keep the marker
              // so a parent that later gains entities can push them down this far too.
              ...(connection.entityPermission
                ? { entityPermission: connection.entityPermission }
                : {}),
            });
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
    const seenConnections = new Set(connections.map(rowKey));
    const lateConnections = (await fetchConnections()).filter(
      connection => !seenConnections.has(rowKey(connection)),
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
    for (const objectPermission of achievedPermissions) {
      const inherited = obj.filter(i => i.subjectPermission === objectPermission);
      if (!inherited.length) continue;
      // Rows on other objects that inherit from `object` via `objectPermission`: push
      // the entities `object` just gained down to them, one page at a time.
      let lastId: string | undefined;
      for (;;) {
        const childIndexes = await ObjectIndex.getInstance().findMany(
          {
            subject: { $ne: `${object}#${objectPermission}` },
            entityId: object.split(':')[1],
            entityType: object.split(':')[0],
            entityPermission: objectPermission,
            ...(lastId ? { _id: { $gt: lastId } } : {}),
          },
          { readPreference: 'primary', sort: { _id: 1 }, limit: PAGE_SIZE },
        );
        if (!childIndexes.length) break;
        lastId = childIndexes[childIndexes.length - 1]._id;
        const childObj: Partial<ObjectIndex>[] = [];
        for (const childIndex of childIndexes) {
          const copy = omit(childIndex, ['_id', 'createdAt', 'updatedAt', '__v']);
          for (const childObject of inherited) {
            if (childObject.entityType === copy.entityType) continue;
            childObj.push({
              ...copy,
              entity: childObject.entity,
              entityId: childObject.entityId,
              entityType: childObject.entityType,
              entityPermission: childObject.entityPermission,
              relation: childObject.relation,
              // the path to `object`, then the child's own path from `object` down
              inheritanceTree: [
                ...(childObject.inheritanceTree ?? []),
                ...(copy.inheritanceTree ?? []),
              ],
            });
          }
        }
        await createMissingRows(uniqueRows(childObj));
        if (childIndexes.length < PAGE_SIZE) break;
      }
    }
  };
}

const PAGE_SIZE = 200;

/** Same key shape as IndexController's chunked lookups. */
function rowKey(row: Partial<ObjectIndex>) {
  return `${row.subject}|${row.entity}|${(row.inheritanceTree ?? []).join(',')}`;
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

function findExisting(rows: Partial<ObjectIndex>[]) {
  return ObjectIndex.getInstance().findMany(
    {
      $and: [
        { subject: { $in: [...new Set(rows.map(i => i.subject!))] } },
        { entity: { $in: [...new Set(rows.map(i => i.entity!))] } },
      ],
    },
    { readPreference: 'primary' },
  );
}

/**
 * Writes the rows that do not exist yet, in batches. Existing rows that lack the
 * `entityPermission` marker the computed row carries are upgraded in place, so a
 * re-index backfills rows written before the marker was kept.
 */
async function createMissingRows(rows: Partial<ObjectIndex>[]) {
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    await createMissingBatch(rows.slice(i, i + PAGE_SIZE));
  }
}

async function createMissingBatch(rows: Partial<ObjectIndex>[]) {
  if (!rows.length) return;
  const existing = new Map<string, ObjectIndex[]>();
  for (const index of await findExisting(rows)) {
    const key = rowKey(index);
    existing.set(key, [...(existing.get(key) ?? []), index]);
  }
  const toCreate: Partial<ObjectIndex>[] = [];
  const toMark = new Map<string, string[]>();
  for (const row of rows) {
    const found = existing.get(rowKey(row));
    if (!found) {
      toCreate.push(row);
      continue;
    }
    if (!row.entityPermission) continue;
    for (const index of found) {
      if (index.entityPermission) continue;
      toMark.set(row.entityPermission, [
        ...(toMark.get(row.entityPermission) ?? []),
        index._id,
      ]);
    }
  }
  for (const [entityPermission, ids] of toMark) {
    await ObjectIndex.getInstance().updateMany(
      { _id: { $in: ids } },
      { entityPermission },
    );
  }
  if (!toCreate.length) return;
  await ObjectIndex.getInstance().createMany(toCreate);
  await removeDuplicates(toCreate);
}

/**
 * Two jobs can both find a row missing and both insert it (there is no unique index
 * over the inheritance tree). After inserting, keep the copy with the smallest `_id`
 * per key and delete the rest; every racing job converges on the same survivor.
 */
async function removeDuplicates(rows: Partial<ObjectIndex>[]) {
  const written = new Set(rows.map(rowKey));
  const keep = new Map<string, ObjectIndex>();
  const extra: string[] = [];
  for (const index of await findExisting(rows)) {
    const key = rowKey(index);
    if (!written.has(key)) continue;
    const kept = keep.get(key);
    if (!kept) {
      keep.set(key, index);
    } else if (String(index._id) < String(kept._id)) {
      extra.push(kept._id);
      keep.set(key, index);
    } else {
      extra.push(index._id);
    }
  }
  if (extra.length) {
    await ObjectIndex.getInstance().deleteMany({ _id: { $in: extra } });
  }
}
