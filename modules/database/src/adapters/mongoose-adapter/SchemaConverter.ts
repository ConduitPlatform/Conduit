import { Schema } from 'mongoose';
import {
  ConduitModelField,
  ConduitSchema,
  MongoIndexType,
  MongoIndexOptions,
  SchemaFieldIndex,
  PostgresIndexOptions,
} from '@conduitplatform/grpc-sdk';
import { isNil, isObject, cloneDeep, values } from 'lodash';
const deepdash = require('deepdash/standalone');

/**
 * This function should take as an input a JSON schema and convert it to the mongoose equivalent
 * @param jsonSchema
 */
export function schemaConverter(jsonSchema: ConduitSchema) {
  let copy = cloneDeep(jsonSchema);
  if (copy.fields.hasOwnProperty('_id')) {
    delete copy.fields['_id'];
  }
  copy = convertSchemaFieldIndexes(copy);
  deepdash.eachDeep(copy.fields, convert);
  if (copy.modelOptions.indexes) {
    copy = convertModelOptionsIndexes(copy);
  }
  return copy;
}

function convert(value: any, key: any, parentValue: any, context: any) {
  if (!parentValue?.hasOwnProperty(key)) {
    return true;
  }

  if (isObject(parentValue[key]?.type) && key !== 'database' && key !== 'variables') {
    const typeSchema = new ConduitSchema(`${key}_type`, parentValue[key].type, {
      _id: false,
      timestamps: false,
    });
    parentValue[key] = schemaConverter(typeSchema).fields;
    return true;
  }

  if (parentValue[key]?.type === 'Relation') {
    const current = parentValue[key];
    current.type = Schema.Types.ObjectId;
    current.ref = parentValue[key].model;
    delete current.model;
  }

  if (parentValue[key]?.type === 'JSON') {
    parentValue[key].type = Schema.Types.Mixed;
  }

  if (!isNil(parentValue[key]) && parentValue[key] === 'JSON') {
    parentValue[key] = Schema.Types.Mixed;
  }

  if (parentValue[key]?.systemRequired) {
    // Remove this after custom modules are updated
    delete parentValue[key].systemRequired;
  }
}

function convertSchemaFieldIndexes(copy: ConduitSchema) {
  for (const field of Object.entries(copy.fields)) {
    const index = (field[1] as ConduitModelField).index;
    if (!index) continue;
    const indexType = index.type;
    const options = index.options;
    if (!indexType && !options) {
      throw new Error('Index should have at least a type or some options');
    }
    if (indexType && !Object.values(MongoIndexType).includes(indexType)) {
      throw new Error('Incorrect index type for MongoDB');
    }
    if (options) {
      if (!checkIfMongoOptions(options)) {
        throw new Error('Incorrect index options for MongoDB');
      }
      for (const [option, optionValue] of Object.entries(options)) {
        index[option as keyof SchemaFieldIndex] = optionValue;
      }
      delete index.options;
    }
  }
  return copy;
}

function convertModelOptionsIndexes(copy: ConduitSchema) {
  for (const index of copy.modelOptions.indexes!) {
    // compound indexes are maintained in modelOptions in order to be created after schema creation
    //single field index => add it to specified field
    if (index.fields.length === 1) {
      const modelField = copy.fields[index.fields[0]] as ConduitModelField;
      if (!modelField) {
        throw new Error(`Field ${modelField} in index definition doesn't exist`);
      }
      if (index.types) {
        if (index.fields.length !== index.types.length) {
          throw new Error("Number of index types doesn't match number of fields");
        }
        if (!Object.values(MongoIndexType).includes(index.types[0])) {
          throw new Error('Incorrect index type for MongoDB');
        }
        const indexType = index.types[0] as MongoIndexType;
        modelField.index = {
          type: indexType,
        };
      }
      if (index.options) {
        if (!checkIfMongoOptions(index.options)) {
          throw new Error('Incorrect index options for MongoDB');
        }
        for (const [option, optionValue] of Object.entries(index.options)) {
          modelField.index![option as keyof SchemaFieldIndex] = optionValue;
        }
      }
      copy.modelOptions.indexes!.splice(copy.modelOptions.indexes!.indexOf(index), 1);
    }
  }
  return copy;
}

function checkIfMongoOptions(options: MongoIndexOptions | PostgresIndexOptions) {
  const mongoOptions = [
    'background',
    'unique',
    'name',
    'partialFilterExpression',
    'sparse',
    'expireAfterSeconds',
    'storageEngine',
    'commitQuorum',
    'version',
    'weights',
    'default_language',
    'language_override',
    'textIndexVersion',
    '2dsphereIndexVersion',
    'bits',
    'min',
    'max',
    'bucketSize',
    'wildcardProjection',
    'hidden',
  ];
  const result = Object.keys(options).some(option => !mongoOptions.includes(option));
  return !result;
}
