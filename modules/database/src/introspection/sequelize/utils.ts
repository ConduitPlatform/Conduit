import { TYPE } from "@conduitplatform/grpc-sdk";
import { isNil } from "lodash";
import { Sequelize } from "sequelize";

export const SYSTEM_DB_SCHEMAS = ['CustomEndpoints']; // Check schema entries for cms metadata

/**
 * This function should take as an input a sequelize-auto object and convert it to a conduit schema
 */
export function sqlSchemaConverter(sqlSchema: any) {    
  for(const fieldName of Object.keys(sqlSchema)) {    
    let field = sqlSchema[fieldName];
    field.type = extractType(field.type)
    extractProperties(field)
  }
}

function extractType(type: string) {
  switch (type) {
    case 'TEXT':
    case type.match(/^CHARACTER VARYING/)?.input:
    case 'ENUM':
      return TYPE.String;
    case 'INTEGER':
    case 'SMALLINT':
    case 'BIGINT':
    case 'FLOAT':
    case 'DOUBLE':
    case 'DECIMAL':
    case 'NUMERIC':
      return TYPE.Number;
    case 'BIT':
    case 'BOOLEAN':
      return TYPE.Boolean;
    case 'DATE':
    case 'TIME':
    case 'TIME WITH TIME ZONE':
    case 'TIME WITHOUT TIME ZONE':
    case 'TIMESTAMP':
    case 'TIMESTAMP WITHOUT TIME ZONE':
    case 'TIMESTAMP WITH TIME ZONE':
      return TYPE.Date;
    case 'JSON':
      return TYPE.JSON;
    case 'UUID':
      return TYPE.ObjectId;
    default:
      return TYPE.String;
  }
}

function extractProperties(field: any) {
  if (field.hasOwnProperty('enum')) {
    field.enum = field.special;
    delete field.special;
  }
  if (field.hasOwnProperty('foreignKey') && !field.foreignKey.isPrimaryKey) {
    field.type = TYPE.Relation;
    if(field)
    field.model = field.foreignKey.target_table;
  }
  if (
    (field.type === TYPE.Date && field.defaultValue === 'CURRENT_TIMESTAMP') ||
    field.defaultValue === 'CURRENT_DATE' ||
    field.defaultValue === 'now()'
  ) {
    field.defaultValue = Sequelize.fn('now');
  }
  if (field.hasOwnProperty('defaultValue') && !isNil(field.defaultValue)) {
    field.default = field.defaultValue;
    if(typeof field.default === 'string' && field.default.startsWith('uuid_generate')) {
      field.default = Sequelize.fn(field.default);
    }
  }

  delete field.defaultValue;
  delete field.comment;
  delete field.foreignKey;
}