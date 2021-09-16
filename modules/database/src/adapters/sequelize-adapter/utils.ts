import { Op } from 'sequelize';
import _ from 'lodash';

const deepdash = require('deepdash/standalone');

function arrayHandler(value: any) {
  let newArray = [];
  for (let val of value) {
    newArray.push(parseQuery(val));
  }
  return newArray;
}

function matchOperation(operator: string, value: any) {
  switch (operator) {
    case '$eq':
      return { [Op.eq]: value };
    case '$ne':
      return { [Op.ne]: value };
    case '$gt':
      return { [Op.gt]: value };
    case '$gte':
      return { [Op.gte]: value };
    case '$lt':
      return { [Op.lt]: value };
    case '$lte':
      return { [Op.lte]: value };
    case '$in':
      return { [Op.in]: arrayHandler(value) };
    case '$or':
      return arrayHandler(value);
    case '$and':
      return arrayHandler(value);
    case '$nin':
      return { [Op.notIn]: arrayHandler(value) };
    case '$contains':
      if (Array.isArray(value)) {
        return { [Op.contains]: arrayHandler(value) };
      }
      return { [Op.contains]: value };
    default:
      return value;
  }
}

function replaceInPath(parsed: any, path: any[], replacedValue: any) {
  if (path.indexOf('$or') !== -1) {
    path.splice(path.indexOf('$or'), 1);
    path.push(Op.or);
  } else if (path.indexOf('$and') !== -1) {
    path.splice(path.indexOf('$and'), 1);
    path.push(Op.and);
  }
  return _.set(parsed, path, replacedValue);
}

export function parseQuery(query: any) {
  let parsed: any = {};

  deepdash.eachDeep(query, (value: any, key: any, parentValue: any, context: any) => {
    if (
      !parentValue?.hasOwnProperty(key) ||
      Array.isArray(parentValue) ||
      context._item.strPath.indexOf('[') !== -1
    ) {
      return true;
    }
    let t = matchOperation(key, value);
    let path = context._item.parentItem.path;
    path = path ?? [key];
    parsed = replaceInPath(parsed, path, t);

    // console.log('Value: ', value);
    // console.log('StringPath: ', path);
    // console.log('Key: ', key);
    // console.log('ParentValue: ', parentValue);
  });
  console.log('Sequelize Parse Debug: ', parsed);
  return parsed;
}
