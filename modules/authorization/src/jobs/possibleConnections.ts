import { ObjectIndex, ResourceDefinition } from '../models/index.js';
import { constructObjectIndex, objectIndexKey } from '../utils/index.js';
import { omit } from 'lodash-es';

export type ProcessPossibleConnectionsWorkerData = {
  object: string;
  subject: string;
  relation: string;
  relatedPermissions: { [key: string]: string[] };
  achievedPermissions: string[];
};

/**
 * Indexes `object` for the entities it gains through `subject#relation`, then pushes
 * them down to rows already inheriting from `object`. Runs inside the sandboxed
 * connection worker; kept free of SDK bootstrapping so it can be tested directly.
 */
export async function processPossibleConnections(
  data: ProcessPossibleConnectionsWorkerData,
) {
  const {
    object,
    subject,
    relation,
    relatedPermissions,
    achievedPermissions: providedAchievedPermissions,
  } = data;
  const subjectDefinition = (await ResourceDefinition.getInstance().findOne({
    name: subject.split(':')[0],
  }))!;
  const connectionSubjects = Object.keys(relatedPermissions).map(i => `${subject}#${i}`);
  const fetchConnections = () =>
    ObjectIndex.getInstance().findMany({ subject: { $in: connectionSubjects } });
  const rowsFromConnections = (connections: ObjectIndex[]) => {
    const rows: Partial<ObjectIndex>[] = [];
    for (const action in relatedPermissions) {
      for (const connection of connections) {
        if (connection.subjectPermission !== action) continue;
        for (const permission of relatedPermissions[action]) {
          if (isHookRow(connection)) {
            // Its entity is not `resource#relation`; carry the hook down a level.
            rows.push(
              hookRow(
                object,
                permission,
                `${connection.entityType}:${connection.entityId}`,
                connection.entityPermission,
                [
                  ...(connection.inheritanceTree ?? []),
                  `${subject}#${relation}@${object}`,
                ],
              ),
            );
            continue;
          }
          rows.push({
            ...constructObjectIndex(
              object,
              permission,
              connection.entity.split('#')[1],
              connection.entity.split('#')[0],
              [...(connection.inheritanceTree ?? []), `${subject}#${relation}@${object}`],
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
      const roles = subjectDefinition.permissions[action];
      if (roles.length && roles.every(role => role.indexOf('->') !== -1)) {
        // `subject#action` is only inherited, so it may have no rows yet and nothing
        // here would carry its id. Leave a hook so a parent that later gives
        // `subject` entities for `action` finds `object` in its push-down.
        for (const permission of relatedPermissions[action]) {
          rowsFromSubjectDefinition.push(
            hookRow(object, permission, subject, action, [
              `${subject}#${relation}@${object}`,
            ]),
          );
        }
      }
      for (const role of roles) {
        if (role.indexOf('->') !== -1) continue;
        for (const permission of relatedPermissions[action]) {
          rowsFromSubjectDefinition.push({
            ...constructObjectIndex(object, permission, role, subject, [
              `${subject}#${relation}@${object}`,
            ]),
            entityPermission: action,
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
        undefined,
        undefined,
        PAGE_SIZE,
        { _id: 1 },
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
}

const PAGE_SIZE = 200;

/**
 * Identity plus the `entityPermission` marker. One identity can carry several markers:
 * with `owner->read` and `owner->edit` both on `X#read`, `X#read ← Team#owner` is stored
 * once marked `read` and once marked `edit`, so a parent later granted either action
 * on the team is pushed down to X. Readers dedupe by entity, so the extra row is inert.
 */
function markedKey(row: Partial<ObjectIndex>) {
  return `${objectIndexKey(row)}|${row.entityPermission ?? ''}`;
}

/**
 * A row on `object#permission` that grants nothing and only records that the
 * permission inherits from `resource#action`. Readers match `entity` against
 * ActorIndex entities, which are always `resource#relation`; a hook's entity has no
 * `#`, so it never matches. Its `entityId`/`entityPermission` are what the push-down
 * query looks for, so the parent's entities still reach `object`.
 */
function hookRow(
  object: string,
  permission: string,
  resource: string,
  action: string,
  inheritanceTree: string[],
): Partial<ObjectIndex> {
  return {
    subject: `${object}#${permission}`,
    subjectId: object.split(':')[1],
    subjectType: object.split(':')[0],
    subjectPermission: permission,
    inheritanceTree,
    entity: `${resource}->${action}`,
    entityId: resource.split(':')[1],
    entityType: resource.split(':')[0],
    entityPermission: action,
    relation: `->${action}`,
  };
}

/** Role names never start with `->` (that is how inherited roles are parsed). */
function isHookRow(row: Partial<ObjectIndex>) {
  return !!row.relation?.startsWith('->');
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
    const markers = byIdentity.get(objectIndexKey(row)) ?? new Map();
    byIdentity.set(objectIndexKey(row), markers);
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

/**
 * Stored rows for the batch's (subject, entity) pairs only. Matching every subject
 * against every entity would also return pairs the batch never asked about, which
 * on a push-down page is up to children × inherited entities rows.
 */
function findExisting(rows: Partial<ObjectIndex>[]) {
  const entitiesBySubject = new Map<string, Set<string>>();
  for (const row of rows) {
    let entities = entitiesBySubject.get(row.subject!);
    if (!entities) entitiesBySubject.set(row.subject!, (entities = new Set()));
    entities.add(row.entity!);
  }
  return ObjectIndex.getInstance().findMany({
    $or: [...entitiesBySubject].map(([subject, entities]) => ({
      subject,
      entity: { $in: [...entities] },
    })),
  });
}

function groupByIdentity<T extends Partial<ObjectIndex>>(rows: T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = objectIndexKey(row);
    let group = groups.get(key);
    if (!group) groups.set(key, (group = []));
    group.push(row);
  }
  return groups;
}

/**
 * Writes the rows that do not exist yet, in batches. A missing marker is always
 * inserted as a new row, never written onto a stored unmarked row (from before
 * markers were kept): an in-place update can overwrite another job's marker, or hit a
 * row a concurrent `removeDuplicates` just deleted. Inserts cannot be lost that way;
 * `removeDuplicates` then drops the unmarked copy, so a re-index still backfills.
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
  for (const [identity, computed] of groupByIdentity(rows)) {
    const found = existing.get(identity) ?? [];
    const storedMarkers = new Set(found.map(i => i.entityPermission ?? ''));
    for (const row of computed) {
      const marker = row.entityPermission ?? '';
      // An unmarked row adds nothing once any copy of the identity is stored.
      if (marker ? storedMarkers.has(marker) : found.length) continue;
      toCreate.push(row);
    }
  }
  if (!toCreate.length) return;
  await ObjectIndex.getInstance().createMany(toCreate);
  await removeDuplicates(toCreate);
}

/**
 * Two jobs can both find a row missing and both insert it (there is no unique index
 * over the inheritance tree). After writing, keep the copy with the smallest `_id` per
 * identity and marker, drop unmarked copies of an identity that is now marked, and
 * delete the rest; every racing job converges on the same survivors.
 */
async function removeDuplicates(rows: Partial<ObjectIndex>[]) {
  const written = new Set(rows.map(objectIndexKey));
  const stored = (await findExisting(rows)).filter(i => written.has(objectIndexKey(i)));
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
