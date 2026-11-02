//can be used both for relation checks and permission checks
import { ObjectIndex } from '../models/index.js';

export const PERMISSION_ACTION_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export function hasResourceIdentifier(value: string) {
  return value.includes(':');
}

export function assertPermissionAction(action: string) {
  if (!PERMISSION_ACTION_PATTERN.test(action)) {
    throw new Error(
      'Action must start with a letter and contain only letters, numbers, and underscores',
    );
  }
}

export function assertDistinctResources(subject: string, object: string) {
  if (subject === object) {
    throw new Error('Subject and object must be different');
  }
}

export const checkRelation = (subject: string, relation: string, object: string) => {
  if (!hasResourceIdentifier(subject)) {
    throw new Error('Subject must be a valid resource identifier');
  }
  if (!hasResourceIdentifier(object)) {
    throw new Error('Object must be a valid resource identifier');
  }
  if (!/^[a-zA-Z]+$/.test(relation)) {
    throw new Error('Relation must be a plain string');
  }
  assertDistinctResources(subject, object);
};

/** Validates subject/action/object for permission checks (allows subject === object for self-access). */
export const checkPermissionTuple = (subject: string, action: string, object: string) => {
  if (!hasResourceIdentifier(subject)) {
    throw new Error('Subject must be a valid resource identifier');
  }
  if (!hasResourceIdentifier(object)) {
    throw new Error('Object must be a valid resource identifier');
  }
  assertPermissionAction(action);
};

/** Escape a string for use inside a RegExp literal (e.g. $regex in Mongo). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const computeRelationTuple = (
  subject: string,
  relation: string,
  object: string,
) => {
  return `${subject}#${relation}@${object}`;
};

export const computePermissionTuple = (
  subject: string,
  relation: string,
  object: string,
) => {
  return `${subject}#${relation}@${object}`;
};

export const constructObjectIndex = (
  subject: string,
  permission: string,
  role: string,
  object: string,
  inheritanceTree: string[],
): Partial<ObjectIndex> => {
  const wildcard = role === '*' || object === '*';
  return {
    subject: `${subject}#${permission}`,
    subjectId: subject.split(':')[1],
    subjectType: subject.split(':')[0],
    subjectPermission: permission,
    entity: wildcard ? '*' : `${object}#${role}`,
    entityId: wildcard ? '*' : object.split(':')[1],
    entityType: wildcard ? '*' : object.split(':')[0],
    relation: wildcard ? '*' : role,
    inheritanceTree: inheritanceTree,
  };
};

/** Escape single quotes for safe literal interpolation in generated SQL views. */
function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

export function getPostgresAccessListQuery(
  objectTypeCollection: string,
  subject: string,
  objectType: string,
  action: string,
) {
  const s = escapeSqlLiteral(subject);
  const ot = escapeSqlLiteral(objectType);
  const a = escapeSqlLiteral(action);
  return `
      SELECT s.*
      FROM "${objectTypeCollection}" AS s
      WHERE CAST(s._id AS TEXT) IN (
          SELECT oi."subjectId"
          FROM "cnd_ObjectIndex" AS oi
                   INNER JOIN "cnd_ActorIndex" AS ai ON ai.entity = oi.entity
          WHERE oi."subjectType" = '${ot}'
            AND oi."subjectPermission" = '${a}'
            AND ai.subject = '${s}'
            AND oi.entity <> '*'
          UNION
          SELECT oi."subjectId"
          FROM "cnd_ObjectIndex" AS oi
          WHERE oi."subjectType" = '${ot}'
            AND oi."subjectPermission" = '${a}'
            AND oi.entity = '*'
          UNION
          SELECT p."resourceId"
          FROM "cnd_Permission" AS p
          WHERE p.subject = '${s}'
            AND p.permission = '${a}'
            AND p."resourceType" = '${ot}'
      )
  `;
}

export function getSQLAccessListQuery(
  objectTypeCollection: string,
  subject: string,
  objectType: string,
  action: string,
) {
  const s = escapeSqlLiteral(subject);
  const ot = escapeSqlLiteral(objectType);
  const a = escapeSqlLiteral(action);
  return `SELECT ${objectTypeCollection}.*
          FROM ${objectTypeCollection}
          WHERE CAST(${objectTypeCollection}._id AS CHAR) IN (
              SELECT oi.subjectId
              FROM cnd_ObjectIndex AS oi
                       INNER JOIN cnd_ActorIndex AS ai ON ai.entity = oi.entity
              WHERE oi.subjectType = '${ot}'
                AND oi.subjectPermission = '${a}'
                AND ai.subject = '${s}'
                AND oi.entity <> '*'
              UNION
              SELECT oi.subjectId
              FROM cnd_ObjectIndex AS oi
              WHERE oi.subjectType = '${ot}'
                AND oi.subjectPermission = '${a}'
                AND oi.entity = '*'
              UNION
              SELECT p.resourceId
              FROM cnd_Permission AS p
              WHERE p.subject = '${s}'
                AND p.permission = '${a}'
                AND p.resourceType = '${ot}'
          )`;
}
