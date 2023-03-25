import { Indexable } from '@conduitplatform/grpc-sdk';
import { Op } from 'sequelize';
import { SequelizeSchema } from '../SequelizeSchema';

function patch(query: Indexable, key: string) {
  if (query[key][Op.in]) {
    delete query[key];
    // @ts-ignore
    query[Op.or] = query[key][Op.in].map((value: any) => {
      return { [Op.like]: `%;${value};%` };
    });
  } else if (query[key][Op.notIn]) {
    delete query[key];
    // @ts-ignore
    query[Op.and] = query[key][Op.notIn].map((value: any) => {
      return { [Op.notLike]: `%;${value};%` };
    });
  }
}

export function arrayFind(
  key: string,
  fields: Indexable,
  associations?: { [key: string]: SequelizeSchema | SequelizeSchema[] },
): boolean {
  if (fields[key]) {
    if (Array.isArray(fields[key])) {
      return true;
    } else if (Array.isArray(fields[key].type)) {
      return true;
    }
  } else if (key.indexOf('.') !== -1) {
    const assocKey = key.split('.')[0];
    const remain = key.split('.').slice(1).join('.');
    if (associations && associations[assocKey]) {
      const assoc: SequelizeSchema = Array.isArray(associations[assocKey])
        ? (associations[assocKey] as SequelizeSchema[])[0]
        : (associations[assocKey] as SequelizeSchema);
      return arrayFind(remain, assoc.originalSchema.fields);
    }
  }
  return false;
}

export function arrayPatch(
  query: Indexable | undefined,
  fields: Indexable,
  associations?: { [key: string]: SequelizeSchema | SequelizeSchema[] },
) {
  if (!query) return query;
  const newQuery = Object.assign({}, query);
  for (const key in query) {
    if (fields[key]) {
      if (Array.isArray(fields[key])) {
        patch(newQuery, key);
      } else if (Array.isArray(fields[key].type)) {
        patch(newQuery, key);
      }
    } else if (key.indexOf('.') !== -1) {
      const assocKey = key.split('.')[0];
      if (associations && associations[assocKey]) {
        const assoc: SequelizeSchema = Array.isArray(associations[assocKey])
          ? (associations[assocKey] as SequelizeSchema[])[0]
          : (associations[assocKey] as SequelizeSchema);
        const found = arrayFind(key, assoc.originalSchema.fields);
        if (found) patch(newQuery, key);
      }
    }
  }
  return newQuery;
}
