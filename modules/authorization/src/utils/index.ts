//can be used both for relation checks and permission checks
export const checkRelation = (subject: string, relation: string, object: string) => {
  if (!subject.includes(':')) {
    throw new Error('Subject must be a valid resource identifier');
  }
  if (!object.includes(':')) {
    throw new Error('Object must be a valid resource identifier');
  }
  if (!/^[a-zA-Z]+$/.test(relation)) {
    throw new Error('Relation must be a plain string');
  }
  if (subject === object) {
    throw new Error('Subject and object must be different');
  }
  return;
};

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

export interface AccessListQueryParams {
  objectTypeCollection: string;
  computedTuple: string;
  subject: string;
  objectType: string;
  action: string;
}

export function getPostgresAccessListQuery(params: AccessListQueryParams) {
  const { objectTypeCollection, computedTuple, subject, objectType, action } = params;
  return `SELECT "${objectTypeCollection}".* FROM "${objectTypeCollection}"
          INNER JOIN (
              SELECT * FROM "cnd_Permission"
              WHERE "computedTuple" LIKE '${computedTuple}%'
          ) permissions ON permissions."computedTuple" = '${computedTuple}:' || "${objectTypeCollection}"._id
          INNER JOIN (
              SELECT * FROM "cnd_ActorIndex"
              WHERE subject = '${subject}'
          ) actors ON 1=1
          INNER JOIN (
              SELECT * FROM "cnd_ObjectIndex"
              WHERE subject LIKE '${objectType}:%#${action}'
          ) objects ON actors.entity = objects.entity;`;
}

export function getSQLAccessListQuery(params: AccessListQueryParams) {
  const { objectTypeCollection, computedTuple, subject, objectType, action } = params;
  return `SELECT ${objectTypeCollection}.* FROM ${objectTypeCollection}
        INNER JOIN (
            SELECT * FROM cnd_Permission
            WHERE computedTuple LIKE '${computedTuple}%'
        ) permissions ON permissions.computedTuple = '${computedTuple}:' || ${objectTypeCollection}._id
        INNER JOIN (
            SELECT * FROM cnd_ActorIndex
            WHERE subject = '${subject}'
        ) actors ON 1=1
        INNER JOIN (
            SELECT * FROM cnd_ObjectIndex
            WHERE subject LIKE '${objectType}:%#${action}'
        ) objects ON actors.entity = objects.entity;`;
}

export function getMongoAccessListQuery(params: AccessListQueryParams) {
  const { subject, objectType, action } = params;
  return [
    // permissions lookup won't work this way
    {
      $lookup: {
        from: 'cnd_permissions',
        let: { x_id: { $toString: '$_id' } },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [
                  '$computedTuple',
                  { $concat: [`${subject}#${action}@${objectType}:`, '$$x_id'] },
                ],
              },
            },
          },
        ],
        as: 'permissions',
      },
    },
    {
      $lookup: {
        from: 'cnd_actorindexes',
        let: {
          subject: subject,
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$subject', '$$subject'],
              },
            },
          },
        ],
        as: 'actors',
      },
    },
    {
      $lookup: {
        from: 'cnd_objectindexes',
        let: {
          id_action: {
            $concat: [`${objectType}:`, { $toString: '$_id' }, `#${action}`],
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ['$subject', '$$id_action'],
              },
            },
          },
        ],
        as: 'objects',
      },
    },
    {
      $addFields: {
        intersection: {
          $setIntersection: ['$actors.entity', '$objects.entity'],
        },
      },
    },
    {
      $match: {
        intersection: { $ne: [] },
      },
    },
    {
      $project: {
        actors: 0,
        objects: 0,
        permissions: 0,
        intersection: 0,
      },
    },
  ];
}
