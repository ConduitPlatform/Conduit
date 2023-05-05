import {
  ConduitSchema,
  Indexable,
  SQLDataType,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import { DataTypes } from 'sequelize';
import { cloneDeep, isArray, isObject } from 'lodash';
import {
  checkDefaultValue,
  convertModelOptionsIndexes,
  convertSchemaFieldIndexes,
  extractFieldProperties,
} from '../../utils';
import { sqlDataTypeMap } from '../utils/sqlTypeMap';
import { extractRelations, RelationType } from '../utils/extractors';

/**
 * This function should take as an input a JSON schema and convert it to the sequelize equivalent
 * @param jsonSchema
 */
export function sqlSchemaConverter(
  jsonSchema: ConduitSchema,
): [ConduitSchema, { [key: string]: RelationType | RelationType[] }] {
  let copy = cloneDeep(jsonSchema);
  if (copy.fields.hasOwnProperty('_id')) {
    delete copy.fields['_id'];
  }
  if (copy.modelOptions.indexes) {
    copy = convertModelOptionsIndexes(copy);
  }
  const extractedRelations = extractRelations(jsonSchema.fields, copy.fields);
  copy = convertSchemaFieldIndexes(copy);
  iterDeep(jsonSchema.fields, copy.fields);
  return [copy, extractedRelations];
}

function extractType(type: string, sqlType?: SQLDataType) {
  if (sqlType) {
    const expectedType = sqlDataTypeMap.get(sqlType);
    if (expectedType && type !== expectedType) {
      throw new Error(
        `Invalid data type for SQL data type ${sqlType}: expected ${expectedType}, but got ${type}`,
      );
    }
  }
  switch (type) {
    case 'String':
      if (sqlType === SQLDataType.CHAR) {
        return DataTypes.CHAR;
      } else if (sqlType === SQLDataType.VARCHAR) {
        return DataTypes.STRING;
      } else if (sqlType === SQLDataType.TEXT) {
        return DataTypes.TEXT;
      } else {
        return DataTypes.STRING;
      }
    case 'Number':
      if (sqlType === SQLDataType.BIGINT) {
        return DataTypes.BIGINT;
      } else if (sqlType === SQLDataType.INT) {
        return DataTypes.INTEGER;
      } else if (sqlType === SQLDataType.FLOAT) {
        return DataTypes.FLOAT;
      } else if (sqlType === SQLDataType.DOUBLE) {
        return DataTypes.DOUBLE;
      } else if (sqlType === SQLDataType.DECIMAL) {
        return DataTypes.DECIMAL;
      } else {
        return DataTypes.FLOAT;
      }
    case 'Boolean':
      return DataTypes.BOOLEAN;
    case 'Date':
      if (sqlType === SQLDataType.TIME) {
        return DataTypes.TIME;
      } else if (sqlType === SQLDataType.DATETIME || sqlType === SQLDataType.TIMESTAMP) {
        return DataTypes.DATE;
      } else {
        return DataTypes.DATE;
      }
    case 'JSON':
      return DataTypes.JSON;
    case 'Relation':
    case 'ObjectId':
      return DataTypes.UUID;
  }

  throw new Error('Failed to extract embedded object type');
}

function iterDeep(schema: any, resSchema: any) {
  for (const key of Object.keys(schema)) {
    if (isArray(schema[key])) {
      resSchema[key] = extractArrayType(schema[key], key);
    } else if (isObject(schema[key])) {
      const extraction = extractObjectType(schema[key], key);
      if (!extraction.hasOwnProperty('type')) {
        const taf: any = {};
        const newFields: any = {};
        iterDeep(extraction, taf);
        // unwrap the taf object to a new object that is not nested
        for (const tafKey of Object.keys(taf)) {
          newFields[`${key}.${tafKey}`] = taf[tafKey];
        }
        delete resSchema[key];
        // resSchema is passed by reference, so we can just add the new fields to it
        Object.assign(resSchema, newFields);
      } else {
        resSchema[key] = extraction;
      }
    } else {
      resSchema[key] = extractType(schema[key]);
    }
  }
}

function extractArrayType(arrayField: UntypedArray, field: string) {
  let arrayElementType;
  if (arrayField[0] !== null && typeof arrayField[0] === 'object') {
    if (arrayField[0].hasOwnProperty('type')) {
      arrayElementType = extractType(arrayField[0].type);
    } else {
      throw new Error('Failed to extract embedded object type');
    }
  } else {
    arrayElementType = extractType(arrayField[0]);
  }
  if (arrayElementType === DataTypes.JSON) {
    return { type: DataTypes.JSON };
  } else {
    return {
      type: DataTypes.STRING,
      get(): any {
        // @ts-ignore
        return this.getDataValue(field).split(';');
      },
      set(val: any): any {
        // @ts-ignore
        this.setDataValue(field, val.join(';'));
      },
    };
  }
}

function extractObjectType(objectField: Indexable, field: string) {
  const res: {
    type: any;
    defaultValue?: any;
    primaryKey?: boolean;
    unique?: boolean;
    allowNull?: boolean;
  } = { type: null };

  if (objectField.hasOwnProperty('type')) {
    if (isArray(objectField.type)) {
      res.type = extractArrayType(objectField.type, field).type;
    } else if (isObject(objectField.type)) {
      return objectField.type;
    } else {
      res.type = extractType(objectField.type, objectField.sqlType);
    }
    res.type = extractType(objectField.type, objectField.sqlType);
    if (objectField.hasOwnProperty('default')) {
      res.defaultValue = checkDefaultValue(objectField.type, objectField.default);
    }
  } else {
    return objectField;
  }

  return extractFieldProperties(objectField, res);
}
