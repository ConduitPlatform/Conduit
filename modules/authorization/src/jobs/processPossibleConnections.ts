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
    const seenConnections = new Set(connections.map(markedKey));
    const lateConnections = (await fetchConnections()).filter(
      connection => !seenConnections.has(markedKey(connection)),
    );
    if (lateConnections.length) {
      const known = new Set(obj.map(markedKey));
      const lateRows = uniqueRows(rowsFromConnections(lateConnections)).filter(
        row => !known.has(markedKey(row)),
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
            // Only skip self-references (an entity on `object` or on the child that is
            // that resource itself, possible with cyclic relations). Same-type nesting,
            // e.g. Folder in Folder, must still propagate.
            if (isSameResource(childObject, object)) continue;
            if (isSameResource(childObject, `${copy.subjectType}:${copy.subjectId}`)) {
              continue;
            }
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

/** Same key shape as IndexController's chunked lookups: the row's identity. */
function rowKey(row: Partial<ObjectIndex>) {
  return `${row.subject}|${row.entity}|${(row.inheritanceTree ?? []).join(',')}`;
}

/**
 * Identity plus the `entityPermission` marker. One identity can carry several markers:
 * with `owner->read` and `owner->edit` both on `X#read`, `X#read ← Team#owner` is stored
 * once marked `read` and once marked `edit`, so a parent later granted either action
 * on the team is pushed down to X. Readers dedupe by entity, so the extra row is inert.
 */
function markedKey(row: Partial<ObjectIndex>) {
  return `${rowKey(row)}|${row.entityPermission ?? ''}`;
}

function isSameResource(row: Partial<ObjectIndex>, resource: string) {
  const [type, id] = resource.split(':');
  return row.entityType === type && row.entityId === id;
}

/**
 * One row per identity and marker. An unmarked row is dropped when the same identity
 * also comes marked: the marker is what the child-propagation query matches on, and
 * the unmarked copy adds nothing.
 */
function uniqueRows(rows: Partial<ObjectIndex>[]) {
  const byIdentity = new Map<string, Map<string, Partial<ObjectIndex>>>();
  for (const row of rows) {
    const markers = byIdentity.get(rowKey(row)) ?? new Map();
    byIdentity.set(rowKey(row), markers);
    if (!markers.has(row.entityPermission ?? '')) {
      markers.set(row.entityPermission ?? '', row);
    }
  }
  const result: Partial<ObjectIndex>[] = [];
  for (const markers of byIdentity.values()) {
    if (markers.size > 1) markers.delete('');
    result.push(...markers.values());
  }
  return result;
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

function groupByIdentity<T extends Partial<ObjectIndex>>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    groups.set(rowKey(row), [...(groups.get(rowKey(row)) ?? []), row]);
  }
  return groups;
}

/**
 * Writes the rows that do not exist yet, in batches. A stored row without a marker
 * (written before markers were kept) is upgraded in place to a missing marker instead
 * of inserting a copy, so a re-index backfills existing data.
 */
async function createMissingRows(rows: Partial<ObjectIndex>[]) {
  for (let i = 0; i < rows.length; i += PAGE_SIZE) {
    await createMissingBatch(rows.slice(i, i + PAGE_SIZE));
  }
}

async function createMissingBatch(rows: Partial<ObjectIndex>[]) {
  if (!rows.length) return;
  const existing = groupByIdentity(await findExisting(rows));
  const toCreate: Partial<ObjectIndex>[] = [];
  const toMark = new Map<string, string[]>();
  const touched: Partial<ObjectIndex>[] = [];
  for (const [identity, computed] of groupByIdentity(rows)) {
    const found = existing.get(identity) ?? [];
    const storedMarkers = new Set(found.map(i => i.entityPermission ?? ''));
    const unmarked = found
      .filter(i => !i.entityPermission)
      .sort((a, b) => (String(a._id) < String(b._id) ? -1 : 1));
    for (const row of computed) {
      const marker = row.entityPermission ?? '';
      if (!marker) {
        if (!found.length) toCreate.push(row);
        continue;
      }
      if (storedMarkers.has(marker)) continue;
      const spare = unmarked.shift();
      if (spare) {
        toMark.set(marker, [...(toMark.get(marker) ?? []), spare._id]);
      } else {
        toCreate.push(row);
      }
      touched.push(row);
    }
  }
  for (const [entityPermission, ids] of toMark) {
    await ObjectIndex.getInstance().updateMany(
      { _id: { $in: ids } },
      { entityPermission },
    );
  }
  if (toCreate.length) {
    await ObjectIndex.getInstance().createMany(toCreate);
  }
  touched.push(...toCreate.filter(row => !row.entityPermission));
  if (touched.length) await removeDuplicates(touched);
}

/**
 * Two jobs can both find a row missing and both insert it (there is no unique index
 * over the inheritance tree). After writing, keep the copy with the smallest `_id` per
 * identity and marker, drop unmarked copies of an identity that is now marked, and
 * delete the rest; every racing job converges on the same survivors.
 */
async function removeDuplicates(rows: Partial<ObjectIndex>[]) {
  const written = new Set(rows.map(rowKey));
  const stored = (await findExisting(rows)).filter(i => written.has(rowKey(i)));
  const extra: string[] = [];
  for (const group of groupByIdentity(stored).values()) {
    const hasMarked = group.some(i => i.entityPermission);
    const keep = new Map<string, ObjectIndex>();
    for (const index of group) {
      if (hasMarked && !index.entityPermission) {
        extra.push(index._id);
        continue;
      }
      const key = markedKey(index);
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
  }
  if (extra.length) {
    await ObjectIndex.getInstance().deleteMany({ _id: { $in: extra } });
  }
}
