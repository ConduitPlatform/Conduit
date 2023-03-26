import { Indexable } from '@conduitplatform/grpc-sdk';
import { ModelStatic, Op } from 'sequelize';
import { ParsedQuery } from '../../../interfaces';
import { merge } from 'lodash';
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
      return arrayFind(remain, assoc.originalSchema.fields, assoc.associations);
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
        const found = arrayFind(key, assoc.originalSchema.fields, assoc.associations);
        if (found) patch(newQuery, key);
      }
    }
  }
  return newQuery;
}

export function extractAssociationsFromObject(
  query: ParsedQuery | ParsedQuery[],
  associations?: { [key: string]: SequelizeSchema | SequelizeSchema[] },
): { [key: string]: string[] } {
  const requiredAssociations: { [key: string]: string[] } = {};
  if (!associations) return {};
  if (Array.isArray(query)) {
    query
      .map(q => extractAssociationsFromObject(q, associations))
      .forEach(assoc => merge(requiredAssociations, assoc));
    return requiredAssociations;
  }
  for (const assoc in associations) {
    if (query[assoc]) {
      if (!requiredAssociations[assoc]) {
        requiredAssociations[assoc] = [assoc];
      }
      const newAssoc = Array.isArray(associations[assoc])
        ? (associations[assoc] as any[])[0]
        : associations[assoc];
      const embeddedAssociations = extractAssociationsFromObject(
        query[assoc],
        newAssoc.associations,
      );
      for (const embeddedAssoc in embeddedAssociations) {
        requiredAssociations[assoc].push(`${assoc}.${embeddedAssoc}`);
      }
    }
  }
  return requiredAssociations;
}

export const extractAssociations = (
  model: ModelStatic<any>,
  associations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
) => {
  for (const association in associations) {
    if (associations.hasOwnProperty(association)) {
      const value = associations[association];
      if (Array.isArray(value)) {
        const item = value[0];
        model.hasMany(item.model, {
          foreignKey: association,
          as: association,
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        });
      } else {
        model.hasOne(value.model, {
          foreignKey: association,
          as: association,
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        });
      }
    }
  }
};
