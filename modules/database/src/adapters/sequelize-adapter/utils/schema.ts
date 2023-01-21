import { SequelizeSchema } from '../SequelizeSchema';
import { DataTypes, ModelStatic, Sequelize } from 'sequelize';
import deepdash from 'deepdash/es/standalone';
import { Indexable } from '@conduitplatform/grpc-sdk';

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
        });
      } else {
        model.hasOne(value.model, {
          foreignKey: association,
          as: association,
        });
      }
    }
  }
};

export const sqlTypesProcess = (
  sequelize: Sequelize,
  schema: Indexable,
  excludedFields: string[],
  relations: Indexable,
) => {
  let primaryKeyExists = false;
  let idField: string | null = null;

  deepdash.eachDeep(
    schema.fields,
    //@ts-ignore
    (value: Indexable, key: string, parentValue: Indexable) => {
      if (!parentValue?.hasOwnProperty(key!)) {
        return true;
      }

      if (parentValue[key].hasOwnProperty('select')) {
        if (!parentValue[key].select) {
          excludedFields.push(key);
        }
      }

      if (
        parentValue[key].hasOwnProperty('type') &&
        parentValue[key].type === 'Relation'
      ) {
        relations[key] = parentValue[key].model;
      }

      if (parentValue[key].hasOwnProperty('type') && parentValue[key].type === 'JSON') {
        const dialect = sequelize.getDialect();
        if (dialect === 'postgres') {
          parentValue[key].type = DataTypes.JSONB;
        }
      }

      if (parentValue[key].hasOwnProperty('primaryKey') && parentValue[key].primaryKey) {
        primaryKeyExists = true;
        idField = key;
      }
    },
  );
  if (!primaryKeyExists) {
    schema.fields._id = {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    };
  } else {
    schema.fields._id = {
      type: DataTypes.VIRTUAL,
      get() {
        return `${this[idField!]}`;
      },
    };
  }
};
