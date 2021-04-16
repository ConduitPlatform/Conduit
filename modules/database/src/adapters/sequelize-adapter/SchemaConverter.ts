import { ConduitSchema } from '@quintessential-sft/conduit-grpc-sdk';
import { DataTypes } from 'sequelize';
import * as _ from 'lodash';
import { isBoolean, isNumber, isString } from 'lodash';

/**
 * This function should take as an input a JSON schema and convert it to the sequelize equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema) {
  let copy = _.cloneDeep(jsonSchema) as any;
  let actual: any = copy.modelSchema;

  if (actual.hasOwnProperty('_id')) {
    delete actual['_id'];
  }

  iterDeep(jsonSchema.modelSchema, copy.modelSchema);

  return copy;
}

function iterDeep(schema: any, resSchema: any) {
  Object.keys(schema).forEach((key) => {
    if (schema[key] !== null && typeof schema[key] === 'object') {
      if (schema[key].hasOwnProperty('type')) {
        resSchema[key].type = translateType(schema[key].type);
        if (schema[key].hasOwnProperty('default')) {
          resSchema[key].defaultValue = checkDefaultValue(
            schema[key].type,
            schema[key].default
          );
        }
      } else {
        resSchema[key].type = DataTypes.JSON;
        iterDeep(schema[key], resSchema[key]);
      }
      return;
    }
    resSchema[key] = translateType(schema[key]);
  });
}

function translateType(type: string) {
  switch (type) {
    case 'String':
      return DataTypes.STRING;
    case 'Number':
      return DataTypes.FLOAT;
    case 'Boolean':
      return DataTypes.BOOLEAN;
    case 'Date':
      return DataTypes.DATE;
    case 'JSON':
      return DataTypes.JSON;
    case 'Relation':
    case 'ObjectId':
      return DataTypes.UUID;
  }
}

function checkDefaultValue(type: string, value: string) {
  switch (type) {
    case 'String':
      if (isString(value)) return value;
      return '';
    case 'Number':
      if (isNumber(value)) return value;
      let v = parseFloat(value);
      if (Number.isNaN(v)) return v;
      return 0;
    case 'Boolean':
      if (isBoolean(value)) return value;
      return value === 'true';
    default:
      return value;
  }
}
