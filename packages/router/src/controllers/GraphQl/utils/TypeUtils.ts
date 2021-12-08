const deepdash = require('deepdash/standalone');

function _extractNestedPopulation(path: string) {
  let paths = path.split('.');
  while (paths.indexOf('fieldsByTypeName') !== -1) {
    paths.splice(paths.indexOf('fieldsByTypeName'), 2);
  }
  path = paths.join('.');
  return path;
}

export function findPopulation(fields: any, relations: string[]): string[] | undefined {
  if (relations.length === 0) return undefined;
  let result: string[] = [];
  deepdash.eachDeep(fields, (value: any, key: any, parent: any, context: any) => {
    if (value.fieldsByTypeName) {
      let keys = Object.keys(value.fieldsByTypeName);
      if (
        keys.length > 0 &&
        relations.indexOf(keys[0]) !== -1 &&
        result.indexOf(key) === -1
      ) {
        result.push(_extractNestedPopulation(context._item.strPath));
      }
    }
  });
  return result;
}
