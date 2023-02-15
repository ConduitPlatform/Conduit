import { DataTypes, ModelStatic, Sequelize } from 'sequelize';
import { ConduitSchema, Indexable } from '@conduitplatform/grpc-sdk';
import { SequelizeSchema } from '../SequelizeSchema';

const deepdash = require('deepdash/standalone');

export const extractRelations = (
  name: string,
  originalSchema: ConduitSchema,
  model: ModelStatic<any>,
  relations: { [key: string]: SequelizeSchema | SequelizeSchema[] },
) => {
  for (const relation in relations) {
    if (relations.hasOwnProperty(relation)) {
      const value = relations[relation];
      // many-to-many relations cannot be null
      if (Array.isArray(value)) {
        const item = value[0];
        if (
          item.model.associations[relation] &&
          item.model.associations[relation].foreignKey === name
        ) {
          model.belongsToMany(item.model, {
            foreignKey: item.originalSchema.name,
            as: relation,
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
            through: model.name + '_' + item.originalSchema.name,
          });
          continue;
        } else if (
          item.model.associations[relation] &&
          item.model.associations[relation].foreignKey !== name
        ) {
          throw new Error(
            `Relation ${relation} already exists on ${item.model.name} with a different foreign key`,
          );
        } else {
          model.belongsToMany(item.model, {
            foreignKey: item.originalSchema.name,
            as: relation,
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
            through: model.name + '_' + item.originalSchema.name,
          });
          item.model.belongsToMany(model, {
            foreignKey: name,
            as: relation,
            through: model.name + '_' + item.originalSchema.name,
          });
          item.sync();
        }
      } else {
        model.belongsTo(value.model, {
          foreignKey: {
            name: relation + 'Id',
            allowNull: !(originalSchema.fields[relation] as any).required,
            defaultValue: (originalSchema.fields[relation] as any).default,
          },
          as: relation,
          onUpdate: (originalSchema.fields[relation] as any).required
            ? 'CASCADE'
            : 'NO ACTION',
          onDelete: (originalSchema.fields[relation] as any).required
            ? 'CASCADE'
            : 'SET NULL',
        });
      }
    }
  }
};

export const sqlTypesProcess = (
  sequelize: Sequelize,
  originalSchema: Indexable,
  schema: Indexable,
  excludedFields: string[],
) => {
  let primaryKeyExists = false;
  let idField: string | null = null;

  deepdash.eachDeep(
    originalSchema.fields,
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
  return idField ?? '_id';
};
